def calculate_code(answers):
    # Dummy example, replace with real scoring logic
    scores = {'R': 0, 'I': 0, 'A': 0, 'S': 0, 'E': 0, 'C': 0}
    for ans in answers:
        scores[ans] += 1
    sorted_codes = sorted(scores, key=scores.get, reverse=True)
    return ''.join(sorted_codes[:3])