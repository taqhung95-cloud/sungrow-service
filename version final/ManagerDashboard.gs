/**
 * Dashboard quản lý dùng trực tiếp database của ứng dụng nhập liệu.
 * Không tạo Spreadsheet, không sao chép dữ liệu và không ghi dữ liệu nguồn.
 */
function getManagerDashboard(idToken, rawFilters) {
  const actor = authenticate_(idToken);
  assertManagerDashboardAccess_(actor);
  const filters = normalizeManagerDashboardFilters_(rawFilters);
  const cases = readTable_(SHEETS.cases);
  const workOrders = readTable_(SHEETS.workOrders);
  const workByCase = groupBy_(workOrders, 'Mã hồ sơ');
  const today = startOfDay_(new Date());
  const periodEndForAge = filters.end < today ? filters.end : today;

  const normalized = cases.map(function (item) {
    const works = workByCase[item['Mã hồ sơ']] || [];
    const latest = works.length ? works[works.length - 1] : {};
    const technicalDates = works.map(function (work) { return asDate_(work['Ngày hoàn tất kỹ thuật']); }).filter(Boolean);
    const receivedAt = asDate_(item['Ngày nhận từ khách']);
    const returnedAt = asDate_(item['Ngày trả khách']);
    const technicalCompletedAt = technicalDates.length ? new Date(Math.max.apply(null, technicalDates.map(function (date) { return date.getTime(); }))) : null;
    const dashboardCenter = clean_(latest['Trung tâm xử lý']) || clean_(item['Trung tâm đang giữ hàng']) || clean_(item['Trung tâm tiếp nhận khách']);
    return {
      caseId: clean_(item['Mã hồ sơ']),
      deviceType: clean_(item['Loại thiết bị']),
      serialNumber: clean_(item['Số sê-ri (S/N)']),
      model: clean_(item.Model),
      quantity: Math.max(1, Number(item['Số lượng']) || 1),
      intakeCenter: clean_(item['Trung tâm tiếp nhận khách']),
      currentCenter: clean_(item['Trung tâm đang giữ hàng']),
      dashboardCenter: dashboardCenter,
      caseStatus: clean_(item['Trạng thái hồ sơ']),
      warrantyStatus: clean_(item['Tình trạng bảo hành']),
      sender: senderFromCase_(item),
      receivedAt: receivedAt,
      technicalCompletedAt: technicalCompletedAt,
      returnedAt: returnedAt,
      outcome: clean_(latest['Kết quả xử lý']),
      workflowStatus: clean_(latest['Trạng thái xử lý']),
      updatedAt: asDate_(item['Ngày cập nhật gần nhất'])
    };
  }).filter(function (item) {
    return !filters.center || item.dashboardCenter === filters.center;
  });

  const received = normalized.filter(function (item) { return inDashboardPeriod_(item.receivedAt, filters); });
  const technicalCompleted = normalized.filter(function (item) { return inDashboardPeriod_(item.technicalCompletedAt, filters); });
  const returned = normalized.filter(function (item) { return inDashboardPeriod_(item.returnedAt, filters); });
  const openAtEnd = normalized.filter(function (item) {
    return item.receivedAt && item.receivedAt <= filters.end && (!item.returnedAt || item.returnedAt > filters.end);
  });
  const overdue = openAtEnd.filter(function (item) {
    return dashboardAgeDays_(item.receivedAt, periodEndForAge) > 7;
  });
  const pendingWarranty = openAtEnd.filter(function (item) { return item.warrantyStatus === 'Chờ xác nhận'; });
  const slaPopulation = returned.filter(function (item) {
    const days = dashboardAgeDays_(item.receivedAt, item.returnedAt);
    return days >= 0;
  });
  const slaOnTime = slaPopulation.filter(function (item) {
    return dashboardAgeDays_(item.receivedAt, item.returnedAt) <= 7;
  });

  const availableYears = Array.from(new Set(cases.map(function (item) {
    const date = asDate_(item['Ngày nhận từ khách']);
    return date ? date.getFullYear() : null;
  }).filter(Boolean))).sort(function (a, b) { return b - a; });

  return {
    version: APP_VERSION,
    generatedAt: new Date().toISOString(),
    period: {
      year: filters.year,
      month: filters.month,
      start: dashboardIso_(filters.start),
      end: dashboardIso_(filters.end),
      label: filters.label
    },
    filters: {
      center: filters.center,
      centers: CENTERS.slice(),
      availableYears: availableYears.length ? availableYears : [today.getFullYear()]
    },
    kpis: {
      received: sumDashboardQuantity_(received),
      technicalCompleted: sumDashboardQuantity_(technicalCompleted),
      returned: sumDashboardQuantity_(returned),
      openAtEnd: sumDashboardQuantity_(openAtEnd),
      overdueOpen: sumDashboardQuantity_(overdue),
      pendingWarranty: sumDashboardQuantity_(pendingWarranty),
      slaOnTime: sumDashboardQuantity_(slaOnTime),
      slaPopulation: sumDashboardQuantity_(slaPopulation),
      slaRate: slaPopulation.length ? Math.round(sumDashboardQuantity_(slaOnTime) * 1000 / sumDashboardQuantity_(slaPopulation)) / 10 : null
    },
    receivedByCenter: groupDashboardQuantity_(received, 'dashboardCenter'),
    openByCenter: groupDashboardQuantity_(openAtEnd, 'dashboardCenter'),
    openByStatus: groupDashboardQuantity_(openAtEnd, 'caseStatus'),
    receivedByModel: groupDashboardQuantity_(received, 'model').slice(0, 10),
    monthlyTrend: buildManagerMonthlyTrend_(normalized, filters.year),
    attention: overdue.sort(function (a, b) {
      return dashboardAgeDays_(b.receivedAt, periodEndForAge) - dashboardAgeDays_(a.receivedAt, periodEndForAge);
    }).slice(0, 50).map(function (item) {
      return {
        caseId: item.caseId,
        model: item.model,
        serialNumber: item.serialNumber,
        center: item.dashboardCenter,
        status: item.caseStatus || item.workflowStatus,
        warrantyStatus: item.warrantyStatus,
        receivedAt: dashboardIso_(item.receivedAt),
        ageDays: dashboardAgeDays_(item.receivedAt, periodEndForAge)
      };
    })
  };
}

function assertManagerDashboardAccess_(actor) {
  if (!actor || !actor.isGlobalManager) {
    throw publicError_('Bạn không có quyền truy cập dashboard quản lý.');
  }
}

function normalizeManagerDashboardFilters_(raw) {
  raw = raw || {};
  const now = new Date();
  const year = Math.max(2020, Math.min(2100, Number(raw.year) || now.getFullYear()));
  const month = Math.max(0, Math.min(12, Number(raw.month) || 0));
  const center = clean_(raw.center);
  if (center && CENTERS.indexOf(center) === -1) throw publicError_('Center lọc không hợp lệ.');
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end = month ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);
  return { year: year, month: month, center: center, start: start, end: end, label: month ? ('Tháng ' + month + '/' + year) : ('Năm ' + year) };
}

function buildManagerMonthlyTrend_(records, year) {
  return Array.from({ length: 12 }, function (_, index) {
    const month = index + 1;
    const received = records.filter(function (item) { return item.receivedAt && item.receivedAt.getFullYear() === year && item.receivedAt.getMonth() + 1 === month; });
    const completed = records.filter(function (item) { return item.technicalCompletedAt && item.technicalCompletedAt.getFullYear() === year && item.technicalCompletedAt.getMonth() + 1 === month; });
    const returned = records.filter(function (item) { return item.returnedAt && item.returnedAt.getFullYear() === year && item.returnedAt.getMonth() + 1 === month; });
    return { month: month, received: sumDashboardQuantity_(received), technicalCompleted: sumDashboardQuantity_(completed), returned: sumDashboardQuantity_(returned) };
  });
}

function groupDashboardQuantity_(records, field) {
  const grouped = {};
  records.forEach(function (item) {
    const label = clean_(item[field]) || 'Chưa xác định';
    grouped[label] = (grouped[label] || 0) + item.quantity;
  });
  return Object.keys(grouped).map(function (label) { return { label: label, value: grouped[label] }; }).sort(function (a, b) { return b.value - a.value; });
}

function sumDashboardQuantity_(records) {
  return records.reduce(function (total, item) { return total + Math.max(1, Number(item.quantity) || 1); }, 0);
}

function inDashboardPeriod_(date, filters) {
  return !!date && date >= filters.start && date <= filters.end;
}

function dashboardAgeDays_(start, end) {
  if (!start || !end) return -1;
  return Math.floor((startOfDay_(end).getTime() - startOfDay_(start).getTime()) / 86400000);
}

function startOfDay_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dashboardIso_(date) {
  return date ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}
