import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export default function CreatePost() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newMedia: MediaFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      const preview = URL.createObjectURL(file);
      newMedia.push({ file, preview, type });
    }

    setMedia([...media, ...newMedia]);
  };

  const handleRemoveMedia = (index: number) => {
    const newMedia = [...media];
    URL.revokeObjectURL(newMedia[index].preview);
    newMedia.splice(index, 1);
    setMedia(newMedia);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload media files
      const mediaUrls = await Promise.all(
        media.map(async (file) => {
          const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}-${file.file.name}`);
          const snapshot = await uploadBytes(storageRef, file.file);
          const url = await getDownloadURL(snapshot.ref);
          return {
            url,
            type: file.type
          };
        })
      );

      // Create post document
      const post = {
        userId: user.uid,
        content,
        platforms: selectedPlatforms,
        mediaUrls,
        status: scheduleDate ? 'scheduled' : 'pending',
        scheduledFor: scheduleDate?.toISOString(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'posts'), post);

      // Reset form
      setContent('');
      setSelectedPlatforms([]);
      setScheduleDate(null);
      setMedia([]);
      
    } catch (err) {
      console.error('Error creating post:', err);
      setError('Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Create New Post
        </h3>
        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">Select Platforms</label>
            <div className="mt-2 flex gap-3">
              {['facebook', 'instagram', 'twitter', 'linkedin'].map((platform) => (
                <label key={platform} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlatforms([...selectedPlatforms, platform]);
                      } else {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                      }
                    }}
                  />
                  <span className="ml-2 text-sm text-gray-600 capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Content Input */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Post Content
            </label>
            <div className="mt-1">
              <textarea
                id="content"
                rows={4}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Media (Images/Videos)
            </label>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Upload Media
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
              />
            </div>
            {media.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {media.map((file, index) => (
                  <div key={index} className="relative">
                    {file.type === 'image' ? (
                      <img
                        src={file.preview}
                        alt="Preview"
                        className="h-24 w-24 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={file.preview}
                        className="h-24 w-24 object-cover rounded-lg"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Post */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Schedule Post (Optional)
            </label>
            <div className="mt-1">
              <DatePicker
                selected={scheduleDate}
                onChange={(date) => setScheduleDate(date)}
                showTimeSelect
                dateFormat="MMMM d, yyyy h:mm aa"
                minDate={new Date()}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholderText="Select date and time"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
            >
              {loading ? 'Creating...' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 