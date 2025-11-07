import React from 'react';

interface SkipLinkProps {
    href: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * Skip link component for keyboard navigation accessibility
 */
const SkipLink: React.FC<SkipLinkProps> = ({
    href,
    children,
    className = ''
}) => {
    return (
        <a
            href={href}
            className={`skip-link ${className}`}
            onClick={(e) => {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    (target as HTMLElement).focus();
                    target.scrollIntoView();
                }
            }}
        >
            {children}
        </a>
    );
};

export default SkipLink;