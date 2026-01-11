import { ReactNode } from 'react';

export function ModalShell({
  title,
  subtitle,
  right,
  children,
  onClose,
  wide
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {right}
            <button className="btn btn-icon" onClick={onClose}>×</button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
