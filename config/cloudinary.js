const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloudinary_name' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_key' &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_API_SECRET !== 'your_cloudinary_secret';

let uploadImage, uploadDocument, uploadAny;

if (isCloudinaryConfigured) {
  console.log('☁️ Configuring Cloudinary Storage');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: { 
      folder: 'tech_vaseegrah/images', 
      allowed_formats: ['jpg','jpeg','png','webp'], 
      transformation: [{ width: 800, crop: 'limit' }] 
    }
  });

  const documentStorage = new CloudinaryStorage({
    cloudinary,
    params: { 
      folder: 'tech_vaseegrah/documents', 
      allowed_formats: ['pdf','doc','docx'], 
      resource_type: 'raw' 
    }
  });

  uploadImage = multer({ storage: imageStorage, limits: { fileSize: 5 * 1024 * 1024 } });
  uploadDocument = multer({ storage: documentStorage, limits: { fileSize: 10 * 1024 * 1024 } });
  uploadAny = multer({ storage: imageStorage });
} else {
  console.log('📁 Configuring Local Storage Fallback');
  
  // Resolve path relative to project root (or inside server/)
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const localMulter = multer({
    storage: localStorage,
    limits: { fileSize: 10 * 1024 * 1024 }
  });

  uploadImage = localMulter;
  uploadDocument = localMulter;
  uploadAny = localMulter;
}

module.exports = {
  uploadImage,
  uploadDocument,
  uploadAny
};
