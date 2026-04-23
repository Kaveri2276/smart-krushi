from flask import Flask, render_template, request, jsonify
import json

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/farming-solutions', methods=['POST'])
def farming_solutions():
    data = request.json
    problem = data.get('problem')
    solutions = match_problem(problem)
    return jsonify(solutions)

def match_problem(problem):
    with open('farming_data.json') as f:
        farming_data = json.load(f)
    # A simple keyword matching logic for demonstration
    solutions = [solution for solution in farming_data if solution['keyword'] in problem]
    return solutions

if __name__ == '__main__':
    app.run(debug=True)