import './TopBarButton.css';

import classNames from 'classnames';
import React from 'react';

const TopBarButton: React.FC<Props> = ({className, title, subtitle, ...rest}) => {
  return (
    <div className={classNames('TopBarButton', className)} {...rest}>
      <div className="TopBarButton__button-content">
        <div className="TopBarButton__button-content--title">{title}</div>
        <div className="TopBarButton__button-content--subtitle">{subtitle}</div>
      </div>
    </div>
  );
};
TopBarButton.displayName = 'TopBarButton';

type Props = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
  title: string;
  subtitle: string;
};

export default TopBarButton;
