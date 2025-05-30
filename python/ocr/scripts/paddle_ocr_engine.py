import paddleocr
import numpy as np
import cv2

class PaddleOCREngine:
    """
    OCR engine implementation using PaddleOCR.
    """

    def __init__(self, language: str = 'kor', **kwargs):
        """
        Initializes the PaddleOCR engine.

        Args:
            language: The language code for OCR (e.g., 'en', 'ko').
            **kwargs: Additional arguments for PaddleOCR initialization.
        """
        # Initialize PaddleOCR with specified language and other keyword arguments
        try:
            self.ocr = paddleocr.PaddleOCR(use_angle_cls=True, lang=language, **kwargs)
        except Exception as e:
            print(f"Error initializing PaddleOCR: {e}")
            # Depending on requirements, you might want to raise the exception
            # or handle it differently.
            self.ocr = None # Ensure self.ocr is None if initialization fails

    def run_ocr(self, image_path: str) -> list:
        """
        Runs OCR on a single image tile.

        Args:
            image_path: The path to the image tile file.

        Returns:
            A list of detected text results, where each result is a tuple
            containing the bounding box and the recognized text with confidence.
            Example: [([[x1, y1], [x2, y2], [x3, y3], [x4, y4]], ('text', confidence))]
        """
        if self.ocr is None:
            print("OCR engine not initialized successfully.")
            return []

        try:
            img = cv2.imread(image_path)
            if img is None:
                print(f"Error: Could not read image from {image_path}")
                return []

            # Perform OCR
            results = self.ocr.predict(img)

            # PaddleOCR results are typically a list of pages, then blocks, then lines.
            # We'll extract the line-level results.
            extracted_results = []
            if results and results[0]: # Check if results and the first page exist
                for line_info in results[0]:
                     # line_info is typically [bbox, (text, confidence)]
                    extracted_results.append(line_info)

            return extracted_results
        except Exception as e:
            print(f"Error during OCR processing for {image_path}: {e}")
            return []

# Example usage (optional, for testing)
if __name__ == '__main__':
    # Create a dummy image file for testing
    dummy_image_path = "dummy_tile.png"
    dummy_image = np.zeros((100, 300, 3), dtype=np.uint8)
    cv2.putText(dummy_image, "Test Text 123", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    cv2.imwrite(dummy_image_path, dummy_image)

    ocr_engine = PaddleOCREngine(language='en')
    ocr_results = ocr_engine.run_ocr(dummy_image_path)

    print("OCR Results:")
    for result in ocr_results:
        print(result)

    # Clean up the dummy image file
    import os
    os.remove(dummy_image_path) 