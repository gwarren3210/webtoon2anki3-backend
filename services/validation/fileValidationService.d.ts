/**
 * Validates uploaded image files for type and size.
 *
 * @param file - The file object to validate
 * @returns An object with isValid (boolean) and error (string | null)
 */
export declare function validateImageFile(file: {
    mimetype: string;
    size: number;
}): {
    isValid: boolean;
    error: string | null;
};
