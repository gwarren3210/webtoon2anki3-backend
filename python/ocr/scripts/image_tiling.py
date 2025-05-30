import cv2
from typing import List, Dict, Any
import math
import numpy as np

def tile_image(
    image_path: str,
    tile_height: int,
    overlap: float
) -> List[Dict[str, Any]]:
    """
    Splits an image into overlapping vertical tiles using OpenCV.

    Args:
        image_path (str): Path to the input image file.
        tile_height (int): Height of each tile.
        overlap (float): Overlap ratio (0-1) between tiles.

    Returns:
        List[Dict[str, Any]]: A list of tile information,
                               where each dict contains 'image_data' (numpy.ndarray)
                               and 'bbox' ({ 'x': int, 'y': int, 'width': int, 'height': int }).
    """
    return split_image_into_tiles(image_path, tile_height, overlap)

# --- Helper Functions --- #

def split_image_into_tiles(
    image_path: str,
    tile_height: int,
    overlap: float
) -> List[Dict[str, Any]]:
    """
    Helper function to perform the actual image tiling using OpenCV.

    Args:
        image_path (str): Path to the input image file.
        tile_height (int): Height of each tile.
        overlap (float): Overlap ratio (0-1) between tiles.

    Returns:
        List[Dict[str, Any]]: A list of tile information.
    """
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image from {image_path}")
        return []

    img_height, img_width = img.shape[:2]

    tiles: List[Dict[str, Any]] = []
    step_y = math.floor(tile_height * (1 - overlap))
    if step_y <= 0:
        # Avoid infinite loop or negative steps if overlap is too high
        step_y = 1

    # Tile width is the full image width
    tile_width = img_width

    for y in range(0, img_height, step_y):
        # Calculate the actual height of the current tile
        current_tile_height = min(tile_height, img_height - y)

        # Only create a tile if there's enough height left
        if current_tile_height <= 0:
            break # Reached the bottom of the image

        # Define the bounding box for the tile in the original image
        bbox = {
            'x': 0,
            'y': y,
            'width': tile_width,
            'height': current_tile_height
        }

        # Crop the tile from the image using numpy slicing
        tile_img = img[y : y + current_tile_height, 0 : tile_width]

        tiles.append({
            'image_data': tile_img,
            'bbox': bbox
        })

    return tiles

if __name__ == '__main__':
    # Example usage for testing
    # Create a dummy image file for testing
    # Using OpenCV to create a dummy image
    import os

    dummy_image_path = "dummy_image_cv2.png"
    img_width = 500
    img_height = 2000
    tile_h = 800
    ovlp = 0.25

    # Create a simple gradient image using OpenCV/numpy
    img = np.zeros((img_height, img_width, 3), dtype=np.uint8)
    for i in range(img_height):
        color_val = int(255 * (i / img_height))
        # OpenCV uses BGR format
        img[i, :, :] = [color_val, color_val, color_val] # Grayscale gradient
    cv2.imwrite(dummy_image_path, img)
    print(f"Created dummy image: {dummy_image_path}")

    # Perform tiling
    tiled_images = tile_image(dummy_image_path, tile_h, ovlp)

    print(f"Split image into {len(tiled_images)} tiles.")

    # Save dummy tiles to verify
    output_dir = "dummy_tiles_cv2"
    os.makedirs(output_dir, exist_ok=True)
    for i, tile_info in enumerate(tiled_images):
        tile_img_data = tile_info['image_data']
        bbox = tile_info['bbox']
        cv2.imwrite(os.path.join(output_dir, f"tile_{i}.png"), tile_img_data)
        print(f"Saved tile {i} with bbox: {bbox}")

    # Clean up dummy file and directory
    # os.remove(dummy_image_path)
    # import shutil
    # shutil.rmtree(output_dir)
    print(f"Dummy image and tiles created in {os.path.join(output_dir)}")
    #print("test")
    print(f"There are {len(tiled_images)} tiles in {os.path.join(output_dir)}")
    #for file in os.listdir(output_dir):
    #    print(f"Tile {file} has bbox: {tiled_images[int(file.split('_')[-1].split('.')[0])]['bbox']}")
