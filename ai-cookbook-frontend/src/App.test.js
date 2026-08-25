import { render, screen } from '@testing-library/react';
import App from './App';

test('renders chat input', () => {
  render(<App />);
  expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
});
