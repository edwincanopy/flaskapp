import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Dense, Dropout, ReLU, BatchNormalization
from sklearn.model_selection import train_test_split
from tensorflow.keras.regularizers import l2

import matplotlib.pyplot as plt
import ast
import os
import numpy as np
import re
import sys
import cv2
import dlib
import shutil

detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("./app/shape_predictor_68_face_landmarks.dat")

#define and train the model
class KerasLm2Shapekey(Model):
    def __init__(self, output_size):
        super(KerasLm2Shapekey, self).__init__()
        self.encoder = tf.keras.Sequential([
            Dense(16, activation='relu'),
            BatchNormalization(),
            Dropout(0.32),
            Dense(8, activation='relu'),
            BatchNormalization(),
            Dropout(0.32),
            Dense(output_size)
        ])

    def build(self, input_shape):
        super(KerasLm2Shapekey, self).build(input_shape)
        self.encoder.build(input_shape)

    def call(self, inputs):
        return self.encoder(inputs)
    
    
model = KerasLm2Shapekey(3)
model.build(input_shape=(None, 40))

print('Input dim: 40\nOutput dim: 3')
weights_path = 'app/X6.weights.h5' # CHECK PATH
model.load_weights(weights_path, skip_mismatch=False)
print(f'Loaded model weights from {weights_path}')
print(model.summary())

def get_frames(video_path):
    video = cv2.VideoCapture(video_path)
    frames = []
    fps = video.get(cv2.CAP_PROP_FPS)

    while video.isOpened():
        ret, frame = video.read()
        if not ret:
            break
        frames.append(frame)

    folder = video_path[:-4]
    os.makedirs(folder, exist_ok=True)
    print(f'Created directory {folder}')
    length = len(frames)

    for i, frame in enumerate(frames):
        frame_path = folder + f'/original_frame_{i}.png'
        cv2.imwrite(frame_path, frame)
    print(f'Saved {length} frames')

    return folder, fps


def rescale_lms(lms):
  lms_x = lms[:, 0]
  lms_y = lms[:, 1]
  x_mean = np.mean(lms_x)
  lms_x = lms_x - x_mean
  y_mean = np.mean(lms_y)
  lms_y = lms_y - y_mean

  scale_factor = np.max(lms_y) - np.min(lms_y)
  lms_y = lms_y / scale_factor
  lms_x = lms_x / scale_factor

  return np.column_stack((lms_x, lms_y))

def get_landmarks(folder, image):
    img_path = folder + '/' + image
    img = cv2.imread(img_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = detector(gray)
    all_landmarks = []

    if len(faces) == 0:
        gray = cv2.equalizeHist(gray)
        faces = detector(gray)

    for face in faces:
        landmarks = predictor(gray, face)

        for i in range(48, 68): # ONLY EXTRACT MOUTH LANDMARKS
            x = landmarks.part(i).x
            y = landmarks.part(i).y
            all_landmarks.append([x, y])
            cv2.circle(img, (x, y), 2, (0, 255, 0), -1)

    num = re.findall(r'\d+', image)[0]
    path = f'./{folder}/{num}_frame.png'
    cv2.imwrite(path, img)
    print(f'Saved landmarks for {img_path} at {path}')

    all_landmarks = np.array(all_landmarks)
    #norm_landmarks = (all_landmarks - all_landmarks.min()) / (all_landmarks.max() - all_landmarks.min())
    # NEW
    norm_landmarks = rescale_lms(all_landmarks)
    # END
    return norm_landmarks



def extract_number(filename):
    match = re.search(r'\d+', filename)
    return int(match.group()) if match else 0

def rm_folder(folder):
    if os.path.exists(folder) and os.path.isdir(folder):
        shutil.rmtree(folder)

def main():
    # delete the previous folder (if it exists)
    rm_folder('./uploads/video')

    video = 'uploads/video.mp4'
    folder, fps = get_frames(video)
    
    images = [p for p in os.listdir(folder) if p.startswith('original')]
    images = sorted(images, key=extract_number)
    all_frames = []

    history = None

    for image in images:
        model_input = get_landmarks(folder, image).reshape(1,-1)
        preds = model.predict(model_input).flatten()
        # NEW
        for i, coord in enumerate(preds):
            if coord < -1.5:
                preds[i] = -1.5
            elif coord > 5.0:
                preds[i] = 5.0
        if history is not None:
            this_preds = preds
            preds = 0.8 * this_preds + 0.2 * history # use state (vary the parameter - 0.2 seems quite high)
            history = this_preds
        else:
            history = preds
        # END
        all_frames.append(preds.tolist())

    with open(f'{folder}/pred_frames.txt', 'w') as f:
        f.write(str(all_frames))

    print(f'fps rate: {fps}')


if __name__ == '__main__':
    main()
