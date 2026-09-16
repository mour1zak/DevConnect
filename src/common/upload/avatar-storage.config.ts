import { diskStorage } from 'multer';
import { extname } from 'path';

export const avatarStorage = diskStorage({
  destination: './uploads/avatars',

  filename: (req, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = extname(file.originalname);

    callback(null, `${uniqueSuffix}${extension}`);
  },
});