import './Panel.css';

import classNames from 'classnames';
import React from 'react';

const Panel: React.FC<Props> = ({children, className, title, titleClass, size}) => {
  return (
    <div
      className={classNames(
        'Panel',
        className,
        {'width-one-third': size === 'third'},
        {'width-two-thirds': size === 'twoThirds'},
        {'width-half': size === 'half'},
        {'width-full': size === 'full'},
        {'width-flex': size === 'flex'},
        {'width-fourth': size === 'fourth'},
        {'width-three-fourths': size === 'threeFourths'}
      )}
    >
      {titleClass === 'h1' ? <h1>{title}</h1> : <h2>{title}</h2>}
      {children}
    </div>
  );
};
Panel.displayName = 'Panel';
Panel.defaultProps = {
  size: 'normal',
  titleClass: 'h2',
};

interface Props {
  children: React.ReactNode;
  className?: string;
  titleClass?: 'h1' | 'h2';
  size: 'normal' | 'third' | 'twoThirds' | 'half' | 'full' | 'flex' | 'fourth' | 'threeFourths';
  title: string;
}

export default Panel;
