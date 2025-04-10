from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///finance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    category = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'income' or 'expense'
    description = db.Column(db.String(200))

    def __repr__(self):
        return f"<Transaction {self.id}: {self.type} {self.amount} on {self.date}>"


# 데이터베이스
with app.app_context():
    db.create_all()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/add_transaction', methods=['POST'])
def add_transaction():
    date_str = request.form.get('date')
    date = datetime.strptime(date_str, '%Y-%m-%d').date()
    category = request.form.get('category')
    amount = float(request.form.get('amount'))
    type = request.form.get('type')
    description = request.form.get('description', '')

    transaction = Transaction(
        date=date,
        category=category,
        amount=amount,
        type=type,
        description=description
    )
    db.session.add(transaction)
    db.session.commit()

    return redirect(url_for('index'))


@app.route('/get_transactions')
def get_transactions():
    transactions = Transaction.query.order_by(Transaction.date.desc()).all()
    result = []
    for t in transactions:
        result.append({
            'id': t.id,
            'date': t.date.strftime('%Y-%m-%d'),
            'category': t.category,
            'amount': t.amount,
            'type': t.type,
            'description': t.description
        })
    return jsonify(result)


@app.route('/get_monthly_summary')
def get_monthly_summary():
    # 월별 요약 통계를 제공하는 API
    income_by_month = db.session.query(
        db.func.strftime('%Y-%m', Transaction.date).label('month'),
        db.func.sum(Transaction.amount).label('total')
    ).filter(Transaction.type == 'income').group_by('month').all()

    expense_by_month = db.session.query(
        db.func.strftime('%Y-%m', Transaction.date).label('month'),
        db.func.sum(Transaction.amount).label('total')
    ).filter(Transaction.type == 'expense').group_by('month').all()

    income_data = {m: t for m, t in income_by_month}
    expense_data = {m: t for m, t in expense_by_month}

    months = sorted(set(list(income_data.keys()) + list(expense_data.keys())))

    result = []
    for month in months:
        result.append({
            'month': month,
            'income': income_data.get(month, 0),
            'expense': expense_data.get(month, 0),
            'balance': income_data.get(month, 0) - expense_data.get(month, 0)
        })

    return jsonify(result)


@app.route('/get_yearly_summary')
def get_yearly_summary():
    # 연도별 요약 통계를 제공하는 API
    income_by_year = db.session.query(
        db.func.strftime('%Y', Transaction.date).label('year'),
        db.func.sum(Transaction.amount).label('total')
    ).filter(Transaction.type == 'income').group_by('year').all()

    expense_by_year = db.session.query(
        db.func.strftime('%Y', Transaction.date).label('year'),
        db.func.sum(Transaction.amount).label('total')
    ).filter(Transaction.type == 'expense').group_by('year').all()

    income_data = {y: t for y, t in income_by_year}
    expense_data = {y: t for y, t in expense_by_year}

    years = sorted(set(list(income_data.keys()) + list(expense_data.keys())))

    result = []
    for year in years:
        result.append({
            'year': year,
            'income': income_data.get(year, 0),
            'expense': expense_data.get(year, 0),
            'balance': income_data.get(year, 0) - expense_data.get(year, 0)
        })

    return jsonify(result)

@app.route('/delete_transaction/<int:transaction_id>', methods=['POST'])
def delete_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)
    db.session.delete(transaction)
    db.session.commit()
    return jsonify({"success": True})


@app.route('/filter_transactions', methods=['GET'])
def filter_transactions():
    # 필터 매개변수 가져오기
    month = request.args.get('month', '')
    from_date = request.args.get('from_date', '')
    to_date = request.args.get('to_date', '')
    type_filter = request.args.get('type', '')
    category = request.args.get('category', '')

    # 기본 쿼리 생성
    query = Transaction.query

    # 필터 적용
    if month:
        # 월 필터링 (YYYY-MM 형식)
        query = query.filter(db.func.strftime('%Y-%m', Transaction.date) == month)

    if from_date:
        # 시작 날짜 필터링
        query = query.filter(Transaction.date >= from_date)

    if to_date:
        # 종료 날짜 필터링
        query = query.filter(Transaction.date <= to_date)

    if type_filter:
        # 유형 필터링 (income/expense)
        query = query.filter(Transaction.type == type_filter)

    if category:
        # 카테고리 필터링
        query = query.filter(Transaction.category == category)

    # 결과 정렬 (최신순)
    transactions = query.order_by(Transaction.date.desc()).all()

    # 결과를 JSON으로 변환
    result = []
    total_income = 0
    total_expense = 0

    for t in transactions:
        result.append({
            'id': t.id,
            'date': t.date.strftime('%Y-%m-%d'),
            'category': t.category,
            'amount': t.amount,
            'type': t.type,
            'description': t.description
        })

        # 수입과 지출 합계 계산
        if t.type == 'income':
            total_income += t.amount
        else:
            total_expense += t.amount

    # 응답에 합계 정보 추가
    response = {
        'transactions': result,
        'summary': {
            'income': total_income,
            'expense': total_expense,
            'balance': total_income - total_expense
        }
    }

    return jsonify(response)


@app.route('/get_months')
def get_months():
    # 거래가 있는 모든 월(YYYY-MM) 목록 조회
    months = db.session.query(
        db.func.strftime('%Y-%m', Transaction.date).label('month')
    ).distinct().order_by('month').all()

    result = [m[0] for m in months]
    return jsonify(result)


@app.route('/get_categories')
def get_categories():
    # 모든 카테고리 목록 조회
    categories = db.session.query(
        Transaction.category
    ).distinct().order_by(Transaction.category).all()

    result = [c[0] for c in categories]
    return jsonify(result)


@app.route('/get_current_balance')
def get_current_balance():
    # 전체 잔액 계산
    total_income = db.session.query(
        db.func.sum(Transaction.amount)
    ).filter(Transaction.type == 'income').scalar() or 0

    total_expense = db.session.query(
        db.func.sum(Transaction.amount)
    ).filter(Transaction.type == 'expense').scalar() or 0

    balance = total_income - total_expense

    return jsonify({
        'total_income': total_income,
        'total_expense': total_expense,
        'balance': balance
    })

if __name__ == '__main__':
    app.run(debug=True)
