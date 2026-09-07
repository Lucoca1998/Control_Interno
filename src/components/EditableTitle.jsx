import React, { useState, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';

/**
 * EditableTitle
 * @param {string}   id           - Unique key for localStorage persistence
 * @param {string}   defaultTitle - Default text shown before any edit
 * @param {string}   tag          - HTML tag to render the title ('h1','h2','h3','span','div'...) Default: 'span'
 * @param {object}   style        - Extra inline styles applied to the wrapper
 * @param {string}   iconColor    - Color for the optional icon
 */
export default function EditableTitle({
  id,
  defaultTitle,
  tag = 'span',
  style: extraStyle = {},
  iconColor = '#E61D2B'
}) {
  const storageKey = `coca_chart_title_${id}`;
  const [title, setTitle] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey) || defaultTitle;
    } catch {
      return defaultTitle;
    }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  const handleSave = () => {
    const trimmed = tempTitle.trim() || defaultTitle;
    setTitle(trimmed);
    setIsEditing(false);
    try {
      window.localStorage.setItem(storageKey, trimmed);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancel = () => {
    setTempTitle(title);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flex: 1, ...extraStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          className="form-control"
          style={{ fontSize: '1.05rem', fontWeight: 700, padding: '0.25rem 0.6rem', flex: 1, minWidth: '180px' }}
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
        />
        <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={handleSave} title="Guardar título">
          <Check size={14} />
        </button>
        <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={handleCancel} title="Cancelar">
          <X size={14} />
        </button>
      </div>
    );
  }

  const Tag = tag;

  return (
    <Tag
      className="editable-card-title"
      onClick={() => setIsEditing(true)}
      title="Haz clic para editar el título"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        cursor: 'pointer',
        userSelect: 'none',
        margin: 0,
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        color: '#fff',
        ...extraStyle
      }}
    >
      {title}
      <Edit2
        size={13}
        style={{ color: 'var(--text-muted)', opacity: 0.6, flexShrink: 0, marginLeft: '0.15rem' }}
      />
    </Tag>
  );
}
