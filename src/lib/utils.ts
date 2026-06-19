import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compresses an image file (if it is an image and exceeds a size threshold or is generally large)
 * to be under 800KB. It downscales the image dimensions (max width/height of 1600px) and lowers
 * the JPEG/WebP quality to fit the target threshold automatically.
 */
export async function compressImageIfNeeded(file: File, maxSize: number = 750 * 1024): Promise<string> {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    // For non-images, we just read as standard DataURL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      // If the file is already under the max size, we can return the original data URL
      if (file.size <= maxSize) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 1400;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          } else {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl); // Fallback to original
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress with JPEG format at 0.75 quality first, then try smaller qualities if needed
        let quality = 0.75;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // If it's still too large, let's keep lowering quality (very rarely needed for 1400px at 0.75)
        while (compressedDataUrl.length > maxSize * 1.33 && quality > 0.3) {
          quality -= 0.15;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(dataUrl); // Fallback
      };
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

