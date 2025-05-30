# backend/python/ocr/Dockerfile

# Use an official Python runtime as a parent image
# Using Python 3.8-slim for a smaller image size
FROM python:3.8-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends libgl1-mesa-glx libsm6 libxext6 libfontconfig1 libglib2.0-0

# Install any needed packages specified in requirements.txt
# We'll install opencv-python and paddleocr directly for now
# In a larger project, you might use a requirements.txt
RUN pip install --no-cache-dir opencv-python paddleocr

# Keep the container running (useful for development/debugging)
# or specify an entrypoint for running a specific script
# CMD ["python", "image_tiling.py"]

# We won't define a default command yet, as we'll run specific scripts
# using 'docker run ... <image_name> python <script_name>.py' 

# Mount the scripts directory
VOLUME ["/app/scripts"]
