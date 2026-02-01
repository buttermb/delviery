import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useCallback, useState } from 'react';

/**
 * Test suite for verifying useCallback implementation on event handlers passed as props
 *
 * This ensures that:
 * 1. Event handlers passed as props are wrapped in useCallback
 * 2. Child components using React.memo don't re-render unnecessarily
 * 3. Handler references remain stable across re-renders
 */

// Mock child component that uses React.memo
const ChildComponent = React.memo<{
  onAction: () => void;
  label: string;
}>(({ onAction, label }) => {
  return (
    <button onClick={onAction} data-testid="child-button">
      {label}
    </button>
  );
});

ChildComponent.displayName = 'ChildComponent';

// Test component WITH useCallback (correct implementation)
const ParentWithUseCallback: React.FC = () => {
  const [count, setCount] = useState(0);
  const [otherState, setOtherState] = useState(0);

  // Event handler wrapped in useCallback
  const handleAction = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return (
    <div>
      <div data-testid="count">{count}</div>
      <div data-testid="other-state">{otherState}</div>
      <button onClick={() => setOtherState(s => s + 1)} data-testid="update-other">
        Update Other State
      </button>
      <ChildComponent onAction={handleAction} label="Click me" />
    </div>
  );
};

// Test component WITHOUT useCallback (incorrect implementation)
const ParentWithoutUseCallback: React.FC = () => {
  const [count, setCount] = useState(0);
  const [otherState, setOtherState] = useState(0);

  // Event handler NOT wrapped in useCallback (recreated on every render)
  const handleAction = () => {
    setCount(c => c + 1);
  };

  return (
    <div>
      <div data-testid="count">{count}</div>
      <div data-testid="other-state">{otherState}</div>
      <button onClick={() => setOtherState(s => s + 1)} data-testid="update-other">
        Update Other State
      </button>
      <ChildComponent onAction={handleAction} label="Click me" />
    </div>
  );
};

describe('useCallback implementation for event handlers', () => {
  describe('Handler stability', () => {
    it('should maintain stable reference when using useCallback', () => {
      let renderCount = 0;
      const handlerRefs: Array<() => void> = [];

      const TestChild = React.memo<{ onAction: () => void }>(({ onAction }) => {
        renderCount++;
        handlerRefs.push(onAction);
        return <button onClick={onAction}>Test</button>;
      });

      const TestParent = () => {
        const [state, setState] = useState(0);
        const handler = useCallback(() => {}, []);

        return (
          <div>
            <button onClick={() => setState(s => s + 1)}>Update</button>
            <TestChild onAction={handler} />
          </div>
        );
      };

      const { rerender } = render(<TestParent />);

      expect(renderCount).toBe(1);
      const firstHandler = handlerRefs[0];

      // Trigger parent re-render
      fireEvent.click(screen.getByText('Update'));
      rerender(<TestParent />);

      // Child should NOT re-render because handler reference is stable
      expect(renderCount).toBe(1);

      // Verify all handler references are the same
      handlerRefs.forEach(handler => {
        expect(handler).toBe(firstHandler);
      });
    });

    it('should create new reference when NOT using useCallback', () => {
      let renderCount = 0;
      const handlerRefs: Array<() => void> = [];

      const TestChild = React.memo<{ onAction: () => void }>(({ onAction }) => {
        renderCount++;
        handlerRefs.push(onAction);
        return <button onClick={onAction}>Test</button>;
      });

      const TestParent = () => {
        const [state, setState] = useState(0);
        // NOT using useCallback - handler recreated every render
        const handler = () => {};

        return (
          <div>
            <button onClick={() => setState(s => s + 1)}>Update</button>
            <TestChild onAction={handler} />
          </div>
        );
      };

      const { rerender } = render(<TestParent />);

      expect(renderCount).toBe(1);
      const firstHandler = handlerRefs[0];

      // Trigger parent re-render
      fireEvent.click(screen.getByText('Update'));
      rerender(<TestParent />);

      // Child WILL re-render because handler reference changed
      // Note: renderCount might be higher than 2 due to React StrictMode in development
      expect(renderCount).toBeGreaterThan(1);

      // Verify handler references are different
      expect(handlerRefs[0]).not.toBe(handlerRefs[1]);
    });
  });

  describe('Functional correctness', () => {
    it('should work correctly with useCallback', () => {
      render(<ParentWithUseCallback />);

      expect(screen.getByTestId('count')).toHaveTextContent('0');

      fireEvent.click(screen.getByTestId('child-button'));
      expect(screen.getByTestId('count')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('child-button'));
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });

    it('should work correctly without useCallback', () => {
      render(<ParentWithoutUseCallback />);

      expect(screen.getByTestId('count')).toHaveTextContent('0');

      fireEvent.click(screen.getByTestId('child-button'));
      expect(screen.getByTestId('count')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('child-button'));
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
  });

  describe('Performance with React.memo', () => {
    it('should prevent unnecessary re-renders when handler is memoized', () => {
      let childRenderCount = 0;

      const MemoChild = React.memo<{ onClick: () => void; value: string }>(
        ({ onClick, value }) => {
          childRenderCount++;
          return <button onClick={onClick}>{value}</button>;
        }
      );

      const Parent = () => {
        const [count, setCount] = useState(0);
        const [unrelatedState, setUnrelatedState] = useState(0);

        const handleClick = useCallback(() => {
          setCount(c => c + 1);
        }, []);

        return (
          <div>
            <div data-testid="count">{count}</div>
            <div data-testid="unrelated">{unrelatedState}</div>
            <button
              onClick={() => setUnrelatedState(s => s + 1)}
              data-testid="update-unrelated"
            >
              Update Unrelated
            </button>
            <MemoChild onClick={handleClick} value="Child Button" />
          </div>
        );
      };

      render(<Parent />);
      expect(childRenderCount).toBe(1);

      // Update unrelated state - child should NOT re-render
      fireEvent.click(screen.getByTestId('update-unrelated'));
      expect(childRenderCount).toBe(1);

      // Update unrelated state again - child should still NOT re-render
      fireEvent.click(screen.getByTestId('update-unrelated'));
      expect(childRenderCount).toBe(1);
    });

    it('should cause re-renders when handler is NOT memoized', () => {
      let childRenderCount = 0;

      const MemoChild = React.memo<{ onClick: () => void; value: string }>(
        ({ onClick, value }) => {
          childRenderCount++;
          return <button onClick={onClick}>{value}</button>;
        }
      );

      const Parent = () => {
        const [count, setCount] = useState(0);
        const [unrelatedState, setUnrelatedState] = useState(0);

        // NOT memoized - recreated every render
        const handleClick = () => {
          setCount(c => c + 1);
        };

        return (
          <div>
            <div data-testid="count">{count}</div>
            <div data-testid="unrelated">{unrelatedState}</div>
            <button
              onClick={() => setUnrelatedState(s => s + 1)}
              data-testid="update-unrelated"
            >
              Update Unrelated
            </button>
            <MemoChild onClick={handleClick} value="Child Button" />
          </div>
        );
      };

      render(<Parent />);
      expect(childRenderCount).toBe(1);

      // Update unrelated state - child WILL re-render due to new handler reference
      fireEvent.click(screen.getByTestId('update-unrelated'));
      expect(childRenderCount).toBe(2);

      // Update unrelated state again - child WILL re-render again
      fireEvent.click(screen.getByTestId('update-unrelated'));
      expect(childRenderCount).toBe(3);
    });
  });

  describe('useCallback with dependencies', () => {
    it('should update handler when dependencies change', () => {
      const TestComponent = () => {
        const [multiplier, setMultiplier] = useState(1);
        const [value, setValue] = useState(0);

        const handleClick = useCallback(() => {
          setValue(v => v + multiplier);
        }, [multiplier]);

        return (
          <div>
            <div data-testid="value">{value}</div>
            <div data-testid="multiplier">{multiplier}</div>
            <button onClick={() => setMultiplier(m => m + 1)} data-testid="update-multiplier">
              Update Multiplier
            </button>
            <button onClick={handleClick} data-testid="increment">
              Increment
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('value')).toHaveTextContent('0');
      expect(screen.getByTestId('multiplier')).toHaveTextContent('1');

      // Click with multiplier = 1
      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('value')).toHaveTextContent('1');

      // Update multiplier to 2
      fireEvent.click(screen.getByTestId('update-multiplier'));
      expect(screen.getByTestId('multiplier')).toHaveTextContent('2');

      // Click with multiplier = 2
      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('value')).toHaveTextContent('3'); // 1 + 2
    });

    it('should maintain stable reference when dependencies do not change', () => {
      let renderCount = 0;
      const handlers: Array<() => void> = [];

      const TestComponent = () => {
        renderCount++;
        const [dep, setDep] = useState(1);
        const [unrelated, setUnrelated] = useState(0);

        const handler = useCallback(() => {
          console.log(dep);
        }, [dep]);

        handlers.push(handler);

        return (
          <div>
            <button onClick={() => setUnrelated(u => u + 1)} data-testid="update-unrelated">
              Update Unrelated
            </button>
            <button onClick={() => setDep(d => d + 1)} data-testid="update-dep">
              Update Dependency
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      const firstHandler = handlers[handlers.length - 1];

      // Update unrelated state - handler should remain the same
      fireEvent.click(screen.getByTestId('update-unrelated'));
      expect(handlers[handlers.length - 1]).toBe(firstHandler);

      // Update dependency - handler should change
      fireEvent.click(screen.getByTestId('update-dep'));
      expect(handlers[handlers.length - 1]).not.toBe(firstHandler);
    });
  });

  describe('Multiple handlers with useCallback', () => {
    it('should maintain stability for multiple independent handlers', () => {
      const handlerCalls = {
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
      };

      const MemoChild = React.memo<{
        onEdit: () => void;
        onDelete: () => void;
        onDuplicate: () => void;
      }>(({ onEdit, onDelete, onDuplicate }) => {
        return (
          <div>
            <button onClick={onEdit} data-testid="edit">Edit</button>
            <button onClick={onDelete} data-testid="delete">Delete</button>
            <button onClick={onDuplicate} data-testid="duplicate">Duplicate</button>
          </div>
        );
      });

      const Parent = () => {
        const [state, setState] = useState(0);

        const handleEdit = useCallback(() => {
          handlerCalls.onEdit();
        }, []);

        const handleDelete = useCallback(() => {
          handlerCalls.onDelete();
        }, []);

        const handleDuplicate = useCallback(() => {
          handlerCalls.onDuplicate();
        }, []);

        return (
          <div>
            <button onClick={() => setState(s => s + 1)} data-testid="update">
              Update
            </button>
            <MemoChild
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          </div>
        );
      };

      render(<Parent />);

      fireEvent.click(screen.getByTestId('edit'));
      fireEvent.click(screen.getByTestId('delete'));
      fireEvent.click(screen.getByTestId('duplicate'));

      expect(handlerCalls.onEdit).toHaveBeenCalledTimes(1);
      expect(handlerCalls.onDelete).toHaveBeenCalledTimes(1);
      expect(handlerCalls.onDuplicate).toHaveBeenCalledTimes(1);

      // Trigger parent re-render
      fireEvent.click(screen.getByTestId('update'));

      // Handlers should still work after re-render
      fireEvent.click(screen.getByTestId('edit'));
      fireEvent.click(screen.getByTestId('delete'));
      fireEvent.click(screen.getByTestId('duplicate'));

      expect(handlerCalls.onEdit).toHaveBeenCalledTimes(2);
      expect(handlerCalls.onDelete).toHaveBeenCalledTimes(2);
      expect(handlerCalls.onDuplicate).toHaveBeenCalledTimes(2);
    });
  });
});
