import numpy as np
from typing import List, Tuple, Dict, Any

def bbox_overlap(box1: List[List[int]], box2: List[List[int]]) -> float:
    """
    Calculates the Intersection over Union (IoU) of two bounding boxes.
    Boxes are expected in the format [[x1, y1], [x2, y2], [x3, y3], [x4, y4]].
    This function assumes the boxes are axis-aligned for simplicity in this basic implementation.
    For rotated boxes, a more complex algorithm would be needed.
    """
    # Convert corner points to (x_min, y_min, x_max, y_max) for axis-aligned assumption
    box1_np = np.array(box1)
    box2_np = np.array(box2)

    x1_min, y1_min = np.min(box1_np[:, 0]), np.min(box1_np[:, 1])
    x1_max, y1_max = np.max(box1_np[:, 0]), np.max(box1_np[:, 1])
    x2_min, y2_min = np.min(box2_np[:, 0]), np.min(box2_np[:, 1])
    x2_max, y2_max = np.max(box2_np[:, 0]), np.max(box2_np[:, 1])

    # Determine the coordinates of the intersection rectangle
    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    # Compute the area of intersection rectangle
    inter_area = max(0, inter_x_max - inter_x_min + 1) * max(0, inter_y_max - inter_y_min + 1)

    # Compute the area of both the prediction and ground-truth rectangles
    box1_area = (x1_max - x1_min + 1) * (y1_max - y1_min + 1)
    box2_area = (x2_max - x2_min + 1) * (y2_max - y2_min + 1)

    # Compute the intersection over union by dividing the intersection area by the union area
    iou = inter_area / float(box1_area + box2_area - inter_area)
    return iou

def deduplicate_ocr_results(ocr_results: List[Tuple[List[List[int]], Tuple[str, float]]]) -> List[Tuple[List[List[int]], Tuple[str, float]]]:
    """
    Deduplicates OCR results from overlapping image tiles using a simple IoU and text similarity approach.
    Assumes axis-aligned bounding boxes for simplicity.

    Args:
        ocr_results: A list of OCR results from multiple tiles.
                     Each item in the list is expected to be in the format
                     [([[x1, y1], [x2, y2], [x3, y2], [x4, y4]], ('text', confidence))].

    Returns:
        A list of deduplicated OCR results.
    """
    if not ocr_results:
        return []

    # Sort results by confidence score in descending order
    sorted_results = sorted(ocr_results, key=lambda x: x[1][1], reverse=True)

    keep_results = []
    # Use a boolean array to track which results have been processed/removed
    remove_flags = [False] * len(sorted_results)

    for i in range(len(sorted_results)):
        if remove_flags[i]:
            continue

        # Keep the current result (it has the highest confidence among unprocessed ones)
        keep_results.append(sorted_results[i])

        # Compare with subsequent results
        for j in range(i + 1, len(sorted_results)):
            if remove_flags[j]:
                continue

            box1 = sorted_results[i][0]
            text1, confidence1 = sorted_results[i][1]

            box2 = sorted_results[j][0]
            text2, confidence2 = sorted_results[j][1]

            # Check for overlap based on IoU (threshold can be tuned)
            iou = bbox_overlap(box1, box2)

            # Check for text similarity (simple exact match for now)
            # A more advanced implementation might use string distance metrics
            text_similar = (text1.strip().lower() == text2.strip().lower())

            # If boxes overlap and text is similar, mark the lower confidence result for removal
            if iou > 0.5 and text_similar: # IoU threshold can be adjusted
                remove_flags[j] = True

    return keep_results

# Example usage (optional, for testing)
if __name__ == '__main__':
    # Create dummy OCR results for testing
    dummy_results = [
        [[[10, 10], [100, 10], [100, 30], [10, 30]], ('Hello', 0.95)],
        [[[20, 20], [110, 20], [110, 40], [20, 40]], ('World', 0.92)],
        [[[15, 15], [105, 15], [105, 35], [15, 35]], ('Hello', 0.96)], # Overlapping 'Hello' with higher confidence
        [[[25, 25], [115, 25], [115, 45], [25, 45]], ('World', 0.91)],
        [[[200, 200], [300, 200], [300, 220], [200, 220]], ('Another', 0.98)],
    ]

    deduplicated = deduplicate_ocr_results(dummy_results)

    print("Original Results:")
    for result in dummy_results:
        print(result)

    print("\nDeduplicated Results:")
    for result in deduplicated:
        print(result) 