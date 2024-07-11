from flask import Flask, render_template, request, redirect, url_for, jsonify
import os
import subprocess

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads/'  # Define the folder to store uploaded files
app.config['ALLOWED_EXTENSIONS'] = {'mp4'}  # Set allowed file extensions

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get-file-content', methods=['GET'])
def get_file_content():
    try:
        with open('./uploads/video/pred_frames.txt', 'r') as file:
            content = file.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return redirect(request.url)
    file = request.files['file']
    if file.filename == '':
        return redirect(request.url)
    if file and allowed_file(file.filename):
        filename = file.filename
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return 'File successfully uploaded. Press the back button to return to the animation page.'
    return 'File type not allowed'

@app.route('/run-script', methods=['POST'])
def run_script():
    try:
        result = subprocess.run(['python', './app/infer.py'], capture_output=True, text=True)
        return jsonify({"output": result.stdout})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True)
