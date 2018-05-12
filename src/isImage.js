import imageExtensions from 'image-extensions';
import videoExtensions from 'video-extensions';

export const isImage = ({ ext }) => imageExtensions.includes(ext);
export const isVideo = ({ ext }) => videoExtensions.includes(ext);
