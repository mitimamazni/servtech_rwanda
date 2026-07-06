// Basic guardrails for client-submitted KYC images (selfie / ID document).
// These arrive as base64 data URLs from the browser (camera capture or file upload).

const MAX_DATA_URL_LENGTH = 4 * 1024 * 1024; // ~4MB base64 (~3MB actual image)
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;

// Returns null if valid, or an error message string if not.
// `required` = true means an empty/missing value is itself an error.
const validateImageDataUrl = (value, { required = false, label = 'Image' } = {}) => {
  if (!value) {
    return required ? `${label} is required.` : null;
  }
  if (typeof value !== 'string') {
    return `${label} must be a valid image.`;
  }
  if (value.length > MAX_DATA_URL_LENGTH) {
    return `${label} is too large. Please use a smaller image (max ~3MB).`;
  }
  if (!DATA_URL_PATTERN.test(value)) {
    return `${label} must be a JPEG, PNG, or WEBP image.`;
  }
  return null;
};

module.exports = { validateImageDataUrl };
