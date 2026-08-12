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

  // Rwandan ID numbers are printed with spaces between digit groups, e.g.
  // "1 2002 8 0209268 0 33" rather than one contiguous 16-digit string.
  // Match loosely (optional space before each digit) then strip the spaces out.
  const idMatchRaw = text.match(/\b1\s?[12](?:\s?\d){14}\b/);
  const idMatch = idMatchRaw ? idMatchRaw[0].replace(/\s+/g, '') : '';

  const dateMatch = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);

  // Prefer the line directly under the "Amazina / Names" label - this is
  // where the actual name sits on a standard Rwandan ID, and anchoring on
  // the label avoids accidentally matching header text like "REPUBLIC OF
  // RWANDA", which fits the same all-caps-words pattern.
  const labelIdx = lines.findIndex(l => /amazina|\bnames?\b/i.test(l));
  const HEADER_WORDS = /^(republika|republic|rwanda|indangamuntu|national|identity|card|of)$/i;

  const genericNameLines = lines.filter(line =>
    /^[A-Z][a-zA-Z]+(\s[A-Z][a-zA-Z]+)+$/.test(line) &&
    !line.split(' ').every(w => HEADER_WORDS.test(w))
  );

  let nameLine = '';
  if (labelIdx !== -1 && lines[labelIdx + 1] && /^[A-Za-z\s]+$/.test(lines[labelIdx + 1])) {
    nameLine = lines[labelIdx + 1];
  } else if (genericNameLines.length > 0) {
    nameLine = genericNameLines[0];
  }

  let firstName = '';
  let lastName = '';

  if (nameLine) {
    const parts = nameLine.trim().split(/\s+/);
    // Rwandan IDs print family name(s) first and the given name last
    // (e.g. "MITIMA MANZI Benjamin"), the reverse of "first word = first name".
    firstName = parts[parts.length - 1] || '';
    lastName = parts.slice(0, -1).join(' ') || '';
  }

  return {
    id_number: idMatch || '',
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateMatch
      ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
      : '',
    confidence: result.data.confidence,
  };
};
