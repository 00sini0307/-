let monthlyChart = null;
let yearlyChart = null;

// 날짜 선택기 초기화
flatpickr("#date", {
    dateFormat: "Y-m-d",
    locale: "ko",
    defaultDate: new Date()
});

// 페이지 로드 시 데이터 가져오기
$(document).ready(function() {
    loadTransactions();
    loadMonthlySummary();
    loadYearlySummary();
});

// 거래 내역 가져오기
// 거래 내역 가져오기
function loadTransactions() {
    $.getJSON('/get_transactions', function(data) {
        const tbody = $('#transactionsTable tbody');
        tbody.empty();
        
        $.each(data, function(i, transaction) {
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
                
                // 성공 메시지 표시 (선택 사항)
                alert('거래 내역이 삭제되었습니다.');
            }
        },
        error: function() {
            alert('삭제에 실패했습니다. 다시 시도해주세요.');
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

// 월별 차트 렌더링
function renderMonthlySummaryChart(data) {
    // 최근 6개월만 표시
    const chartData = [...data].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    
    const months = chartData.map(item => {
        const [year, month] = item.month.split('-');
        return `${year.slice(2)}년 ${month}월`;
    });
    
    const incomes = chartData.map(item => item.income);
    const expenses = chartData.map(item => item.expense);
    
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
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 연도별 차트 렌더링
function renderYearlySummaryChart(data) {
    const years = data.map(item => `${item.year}년`);
    const incomes = data.map(item => item.income);
    const expenses = data.map(item => item.expense);
    
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
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
