import { useRef } from 'react';

type ImageUploaderProps = {
  onFileSelect: (file: File) => void;
  imageName: string;
  imagePreview: string | null;
};

export function ImageUploader({ onFileSelect, imageName, imagePreview }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    const selectedFile = fileList?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="upload-control">
      <label
        className={`dropzone image-dropzone${imagePreview ? ' has-file' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.bmp,image/*"
          className="visually-hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        {imagePreview ? (
          <>
            <img src={imagePreview} alt="" className="image-preview" />
            <span className="image-overlay">
              <span>{imageName}</span>
              <strong>Change image</strong>
            </span>
          </>
        ) : (
          <span className="image-empty-state">
            <span className="upload-icon image-icon" aria-hidden="true">▧</span>
            <span className="dropzone-copy">
              <strong>Choose a cover image</strong>
              <small>JPG, PNG, WEBP or BMP</small>
            </span>
            <span className="upload-action">Browse</span>
          </span>
        )}
      </label>
    </div>
  );
}
