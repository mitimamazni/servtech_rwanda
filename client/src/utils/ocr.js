import Tesseract from 'tesseract.js';

export const preprocessImage = (file) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const factor = 1.5;
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, (data[i] - 128)     * factor + 128);
        data[i + 1] = Math.min(255, (data[i + 1] - 128) * factor + 128);
        data[i + 2] = Math.min(255, (data[i + 2] - 128) * factor + 128);
      }
      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    };

    img.src = url;
  });
};

export const extractIdData = async (file, onProgress) => {
  const processedBlob = await preprocessImage(file);

  const result = await Tesseract.recognize(processedBlob, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  const text = result.data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const idMatch = text.match(/\b1[12]\d{14}\b/);
  const dateMatch = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);

  const nameLines = lines.filter(line =>
    /^[A-Z][a-zA-Z]+(\s[A-Z][a-zA-Z]+)+$/.test(line)
  );

  let firstName = '';
  let lastName = '';

  if (nameLines.length > 0) {
    const parts = nameLines[0].split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }

  return {
    id_number: idMatch ? idMatch[0] : '',
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateMatch
      ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
      : '',
    confidence: result.data.confidence,
  };
};
