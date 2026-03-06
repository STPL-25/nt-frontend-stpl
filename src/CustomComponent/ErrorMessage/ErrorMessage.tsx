import { AlertCircle, RefreshCw } from 'lucide-react';
import React, {JSX} from 'react';

type ErrorMessageProps = {
  message?: string;
  description?: string;
  onRetry?: () => void;
  retryText?: string;
  fullScreen?: boolean;
  variant?: 'default' | 'minimal' | 'card';
};

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message = 'Something went wrong',
  description,
  onRetry,
  retryText = 'Try Again',
  fullScreen = false,
  variant = 'default',
}) => {

  const ErrorDefault: React.FC = () => (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        fullScreen ? 'min-h-screen' : 'p-8'
      }`}
    >
      <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{message}</h3>
      {description && (
        <p className="text-gray-600 mb-6 max-w-md">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {retryText}
        </button>
      )}
    </div>
  );

  const ErrorMinimal: React.FC = () => (
    <div
      className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${
        fullScreen ? 'm-8' : ''
      }`}
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-red-800 font-medium">{message}</p>
        {description && <p className="text-red-600 text-sm mt-1">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          {retryText}
        </button>
      )}
    </div>
  );

  const ErrorCard: React.FC = () => (
    <div
      className={`bg-white border border-red-200 rounded-lg shadow-sm ${
        fullScreen ? 'm-8' : 'p-6'
      } ${!fullScreen ? 'p-6' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-red-100 rounded-full">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{message}</h3>
          {description && <p className="text-gray-600 mb-4">{description}</p>}
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {retryText}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const variants: Record<string, JSX.Element> = {
    default: <ErrorDefault />,
    minimal: <ErrorMinimal />,
    card: <ErrorCard />,
  };

  return variants[variant] || variants.default;
};

export default ErrorMessage;
