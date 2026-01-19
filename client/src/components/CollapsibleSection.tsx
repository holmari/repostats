import './CollapsibleSection.css';

import React, {useState} from 'react';
import classNames from 'classnames';

interface Props {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}

const CollapsibleSection: React.FC<Props> = ({
  title,
  defaultExpanded = true,
  children,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={classNames('CollapsibleSection', className)}>
      <button
        className="CollapsibleSection__header"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className="CollapsibleSection__arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        <span className="CollapsibleSection__title">{title}</span>
      </button>
      {isExpanded && <div className="CollapsibleSection__content">{children}</div>}
    </div>
  );
};
CollapsibleSection.displayName = 'CollapsibleSection';

export default CollapsibleSection;
