import './ErrorWrapper.css';

import React from 'react';
import Button from 'react-bootstrap/Button';

const ErrorWrapper: React.FC<Props> = (props) => {
  const {error, children, onClear, ...rest} = props;
  return (
    <div {...rest}>
      {error ? (
        <div className="ErrorWrapper">
          <h2>An error has occurred</h2>
          <div className="ErrorWrapper__error-details">{error.message}</div>
          {Array.isArray(error.stack) && (
            <div className="ErrorWrapper__error-stack">
              {error.stack.map((line) => (
                <pre className="ErrorWrapper__error-stack-line">{line}</pre>
              ))}
            </div>
          )}

          <Button onClick={onClear} variant="outline-warning">
            Let me out!
          </Button>
        </div>
      ) : (
        children
      )}
    </div>
  );
};
ErrorWrapper.displayName = 'ErrorWrapper';

type Props = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
  readonly error?: Error;
  onClear: () => void;
};

export default ErrorWrapper;
