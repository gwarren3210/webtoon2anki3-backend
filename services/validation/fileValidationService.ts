/**
 * Validates uploaded image files for type and size.
 *
 * @param file - The file object to validate
 * @returns An object with isValid (boolean) and error (string | null)
 */
export function validateImageFile(file: { mimetype: string; size: number }): {
  isValid: boolean;
  error: string | null;
} {
  try {
    // Supported image types
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Unsupported file type. Allowed: PNG, JPG, JPEG, WEBP.',
      };
    }
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size exceeds 10MB limit.',
      };
    }
    return { isValid: true, error: null };
  } catch (err) {
    return { isValid: false, error: 'Validation error: ' + (err as Error).message };
  }
} 