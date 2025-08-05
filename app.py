from flask import Flask, render_template, request, redirect, url_for, session
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/assessment', methods=['GET', 'POST'])
def assessment():
    if request.method == 'POST':
        # Capture answers and store in session
        answers = request.form.getlist('answer')
        session['answers'] = answers
        return redirect(url_for('results'))
    # Load questions from JSON
    import json
    with open('data/holland_questions.json') as f:
        questions = json.load(f)
    return render_template('assessment.html', questions=questions)

@app.route('/results')
def results():
    from utils.scorer import calculate_code
    code = calculate_code(session.get('answers', []))
    session['code'] = code
    return render_template('results.html', code=code)

@app.route('/matches')
def matches():
    from utils.matcher import match_majors, match_careers
    code = session.get('code')
    majors = match_majors(code)
    careers = match_careers(code)
    return render_template('matches.html', code=code, majors=majors, careers=careers)

@app.route('/summary')
def summary():
    return render_template('summary.html')

@app.route('/done')
def done():
    return render_template('done.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')  # add login logic later

if __name__ == '__main__':
    app.run(debug=True)
