import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import App from './App';

describe('App', () => {
  it('renders the URL Shortener heading', () => {
    render(<App />);
    expect(screen.getByText('URL Shortener')).toBeInTheDocument();
  });
});
