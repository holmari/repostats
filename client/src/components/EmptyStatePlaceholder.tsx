import './EmptyStatePlaceholder.css';

import React from 'react';

const EmptyStatePlaceholder: React.FC<Props> = ({children}) => {
  return (
    <div className="EmptyStatePlaceholder">
      <h2>Nothing to see here</h2>
      {children}
    </div>
  );
};
EmptyStatePlaceholder.displayName = 'EmptyStatePlaceholder';

interface Props {
  children: React.ReactNode;
}

export default EmptyStatePlaceholder;
