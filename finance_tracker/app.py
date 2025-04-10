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


# 데이터베이스 생성
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

if __name__ == '__main__':
    app.run(debug=True)
