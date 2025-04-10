// 전역 변수
let monthlyChart = null;
let yearlyChart = null;
let currentBalance = 0;

// 날짜 선택기 초기화
$(document).ready(function() {
    // 기본 날짜 선택기
    flatpickr("#date", {
        dateFormat: "Y-m-d",
        locale: "ko",
        defaultDate: new Date()
    });
    
    // 필터용 날짜 선택기
    flatpickr("#filter-date-from", {
        dateFormat: "Y-m-d",
        locale: "ko"
    });
    
    flatpickr("#filter-date-to", {
        dateFormat: "Y-m-d",
        locale: "ko"
    });
    
    // 데이터 로드
    loadTransactions();
    loadMonthlySummary();
    loadYearlySummary();
    loadCurrentBalance();
    
    // 필터 옵션 로드
    loadMonthOptions();
    loadCategoryOptions();
    
    // 필터 버튼 이벤트
    $("#apply-filters").click(function() {
        applyFilters();
    });
    
    $("#reset-filters").click(function() {
        resetFilters();
    });
});

// 현재 총 잔액 로드
function loadCurrentBalance() {
    $.getJSON('/get_current_balance', function(data) {
        currentBalance = data.balance;
        
        // 월별 및 연도별 차트에 현재 잔액 정보를 포함하여 다시 로드
        loadMonthlySummary();
        loadYearlySummary();
    });
}

// 월 옵션 로드
function loadMonthOptions() {
    $.getJSON('/get_months', function(months) {
        const monthSelect = $('#filter-month');
        monthSelect.find('option:not(:first)').remove();
        
        months.forEach(function(month) {
            const [year, monthNum] = month.split('-');
            const displayText = `${year}년 ${monthNum}월`;
            monthSelect.append(`<option value="${month}">${displayText}</option>`);
        });
    });
}

// 카테고리 옵션 로드
function loadCategoryOptions() {
    $.getJSON('/get_categories', function(categories) {
        const categorySelect = $('#filter-category');
        categorySelect.find('option:not(:first)').remove();
        
        categories.forEach(function(category) {
            categorySelect.append(`<option value="${category}">${category}</option>`);
        });
    });
}

// 필터 적용
function applyFilters() {
    const month = $('#filter-month').val();
    const fromDate = $('#filter-date-from').val();
    const toDate = $('#filter-date-to').val();
    const type = $('#filter-type').val();
    const category = $('#filter-category').val();
    
    // API 호출 파라미터 구성
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (type) params.append('type', type);
    if (category) params.append('category', category);
    
    // 필터링된 거래 내역 가져오기
    $.getJSON(`/filter_transactions?${params.toString()}`, function(data) {
        renderTransactionsTable(data.transactions);
        updateFilteredSummary(data.summary);
    });
}

// 필터 초기화
function resetFilters() {
    $('#filter-month').val('');
    $('#filter-date-from').val('');
    $('#filter-date-to').val('');
    $('#filter-type').val('');
    $('#filter-category').val('');
    
    // 모든 거래 내역 다시 로드
    loadTransactions();
}

// 필터링된 요약 정보 업데이트
function updateFilteredSummary(summary) {
    $('#filtered-income').text(`+${summary.income.toLocaleString()}원`);
    $('#filtered-expense').text(`-${summary.expense.toLocaleString()}원`);
    
    const balanceClass = summary.balance >= 0 ? 'text-success' : 'text-danger';
    const balancePrefix = summary.balance >= 0 ? '+' : '';
    $('#filtered-balance').removeClass('text-success text-danger').addClass(balanceClass)
        .text(`${balancePrefix}${summary.balance.toLocaleString()}원`);
}

// 거래 내역 가져오기
function loadTransactions() {
    $.getJSON('/get_transactions', function(data) {
        renderTransactionsTable(data);
        
        // 필터링된 요약 정보 초기화
        const totalIncome = data.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        updateFilteredSummary({
            income: totalIncome,
            expense: totalExpense,
            balance: totalIncome - totalExpense
        });
    });
}

// 거래 내역 테이블 렌더링
function renderTransactionsTable(transactions) {
    const tbody = $('#transactionsTable tbody');
    tbody.empty();
    
    if (transactions.length === 0) {
        tbody.append('<tr><td colspan="6" class="text-center">조회된 거래 내역이 없습니다.</td></tr>');
        return;
    }
    
    $.each(transactions, function(i, transaction) {
        const typeText = transaction.type === 'income' ? '수입' : '지출';
        const typeClass = transaction.type === 'income' ? 'text-success' : 'text-danger';
        const amountPrefix = transaction.type === 'income' ? '+' : '-';
        
        tbody.append(`
            <tr>
                <td>${transaction.date}</td>
                <td>${transaction.category}</td>
                <td>${transaction.description || '-'}</td>
                <td class="${typeClass}">${typeText}</td>
                <td class="${typeClass}">${amountPrefix}${transaction.amount.toLocaleString()}원</td>
                <td>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${transaction.id}">삭제</button>
                </td>
            </tr>
        `);
    });
    
    // 삭제 버튼에 이벤트 핸들러 연결
    $('.delete-btn').click(function() {
        const transactionId = $(this).data('id');
        if (confirm('이 거래 내역을 삭제하시겠습니까?')) {
            deleteTransaction(transactionId);
        }
    });
}

// 월별 요약 가져오기
function loadMonthlySummary() {
    $.getJSON('/get_monthly_summary', function(data) {
        renderMonthlySummaryTable(data);
        renderMonthlySummaryChart(data);
    });
}

// 연도별 요약 가져오기
function loadYearlySummary() {
    $.getJSON('/get_yearly_summary', function(data) {
        renderYearlySummaryTable(data);
        renderYearlySummaryChart(data);
    });
}

// 월별 요약 테이블 렌더링
function renderMonthlySummaryTable(data) {
    const tbody = $('#monthlyTable tbody');
    tbody.empty();
    
    // 최신 달부터 표시하기 위해 데이터 정렬
    data.sort((a, b) => b.month.localeCompare(a.month));
    
    $.each(data, function(i, item) {
        const [year, month] = item.month.split('-');
        tbody.append(`
            <tr>
                <td>${year}년 ${month}월</td>
                <td class="text-success">+${item.income.toLocaleString()}원</td>
                <td class="text-danger">-${item.expense.toLocaleString()}원</td>
                <td class="${item.balance >= 0 ? 'text-success' : 'text-danger'}">
                    ${item.balance >= 0 ? '+' : ''}${item.balance.toLocaleString()}원
                </td>
            </tr>
        `);
    });
}

// 연도별 요약 테이블 렌더링
function renderYearlySummaryTable(data) {
    const tbody = $('#yearlyTable tbody');
    tbody.empty();
    
    // 최신 연도부터 표시하기 위해 데이터 정렬
    data.sort((a, b) => b.year.localeCompare(a.year));
    
    $.each(data, function(i, item) {
        tbody.append(`
            <tr>
                <td>${item.year}년</td>
                <td class="text-success">+${item.income.toLocaleString()}원</td>
                <td class="text-danger">-${item.expense.toLocaleString()}원</td>
                <td class="${item.balance >= 0 ? 'text-success' : 'text-danger'}">
                    ${item.balance >= 0 ? '+' : ''}${item.balance.toLocaleString()}원
                </td>
            </tr>
        `);
    });
}

// 월별 차트 렌더링 함수 수정
function renderMonthlySummaryChart(data) {
    // 최근 6개월만 표시
    const chartData = [...data].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    
    const months = chartData.map(item => {
        const [year, month] = item.month.split('-');
        return `${year.slice(2)}년 ${month}월`;
    });
    
    const incomes = chartData.map(item => item.income);
    const expenses = chartData.map(item => item.expense);
    const balances = chartData.map(item => item.balance);
    
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    // 기존 차트가 있으면 파괴
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    // 새 차트 생성
    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: '수입',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    data: incomes
                },
                {
                    label: '지출',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    data: expenses
                },
                {
                    label: '잔액',
                    type: 'line',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.3,  // 선을 부드럽게 연결
                    data: balances,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: true,
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `현재 총 잔액: ${currentBalance.toLocaleString()}원`,
                    font: {
                        size: 16
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: currentBalance,
                            yMax: currentBalance,
                            borderColor: 'red',
                            borderWidth: 2,
                        }
                    }
                }
            }
        }
    });
}

// 연도별 차트 렌더링 함수 수정
function renderYearlySummaryChart(data) {
    const years = data.map(item => `${item.year}년`);
    const incomes = data.map(item => item.income);
    const expenses = data.map(item => item.expense);
    const balances = data.map(item => item.balance);
    
    const ctx = document.getElementById('yearlyChart').getContext('2d');
    
    // 기존 차트가 있으면 파괴
    if (yearlyChart) {
        yearlyChart.destroy();
    }
    
    // 새 차트 생성
    yearlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: '수입',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    data: incomes
                },
                {
                    label: '지출',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    data: expenses
                },
                {
                    label: '잔액',
                    type: 'line',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.3,  // 선을 부드럽게 연결
                    data: balances,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `현재 총 잔액: ${currentBalance.toLocaleString()}원`,
                    font: {
                        size: 16
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: currentBalance,
                            yMax: currentBalance,
                            borderColor: 'red',
                            borderWidth: 2,
                        }
                    }
                }
            }
        }
    });
}

// 거래 삭제 함수
function deleteTransaction(transactionId) {
    $.ajax({
        url: `/delete_transaction/${transactionId}`,
        type: 'POST',
        success: function(response) {
            if (response.success) {
                // 삭제 성공 시 데이터 다시 로드
                loadTransactions();
                loadMonthlySummary();
                loadYearlySummary();
                loadCurrentBalance();
                loadMonthOptions();
                loadCategoryOptions();
                
                // 성공 메시지 표시 (선택 사항)
                alert('거래 내역이 삭제되었습니다.');
            }
        },
        error: function() {
            alert('삭제에 실패했습니다. 다시 시도해주세요.');
        }
    });
}

// 현재 총 잔액 로드
function loadCurrentBalance() {
    $.getJSON('/get_current_balance', function(data) {
        currentBalance = data.balance;
        
        // 요약 정보 업데이트
        $('#total-income').text(`+${data.total_income.toLocaleString()}원`);
        $('#total-expense').text(`-${data.total_expense.toLocaleString()}원`);
        
        // 잔액에 색상 클래스 적용
        const balanceElement = $('#current-balance');
        balanceElement.removeClass('text-success text-danger');
        
        if (data.balance >= 0) {
            balanceElement.addClass('text-success').text(`+${data.balance.toLocaleString()}원`);
        } else {
            balanceElement.addClass('text-danger').text(`${data.balance.toLocaleString()}원`);
        }
        
        // 월별 및 연도별 차트에 현재 잔액 정보를 포함하여 다시 로드
        loadMonthlySummary();
        loadYearlySummary();
    });
}