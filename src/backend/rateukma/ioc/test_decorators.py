import time
from threading import Thread

import pytest

from . import once

# * Default generated tests for the decorators


def create_test_func(result_value):
    call_count = 0

    @once
    def test_func():
        nonlocal call_count
        call_count += 1
        return result_value

    return test_func, lambda: call_count


def test_single_threaded_call():
    """
    Confirms the function is called only once.
    """
    # Arrange
    get_data, get_count = create_test_func("Initial Data")

    # Act
    result1 = get_data()

    # Assert
    assert result1 == "Initial Data"
    assert get_count() == 1

    # Act
    result2 = get_data()

    # Assert
    assert result2 == "Initial Data"
    assert get_count() == 1


def test_concurrent_first_call():
    # Arrange
    call_count = 0

    @once
    def slow_init():
        nonlocal call_count
        call_count += 1
        time.sleep(0.05)
        return 42

    # Act
    threads = []
    results = []
    num_threads = 20

    def thread_target():
        try:
            results.append(slow_init())
        except RuntimeError as e:
            results.append(e)

    for _ in range(num_threads):
        t = Thread(target=thread_target)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Assert
    assert call_count == 1, f"Expected 1 call, got {call_count}"

    assert all(r == 42 for r in results), "Not all threads received the correct cached result."
    assert len(results) == num_threads, "Not all threads completed successfully."


def test_circular_dependency_detection():
    # Arrange
    call_count = 0

    @once
    def func_a():
        nonlocal call_count
        call_count += 1
        if call_count > 1:
            return 0
        return 100 + func_a()

    # Act
    with pytest.raises(RuntimeError) as excinfo:
        func_a()

    # Assert
    assert "Circular dependency detected" in str(excinfo.value)


def test_exception_propagation_and_retry():
    """
    Confirms the function is re-executed after the first call fails (because result is NOT_SET).
    """
    # Arrange
    call_count = 0

    @once
    def faulty_init():
        nonlocal call_count
        call_count += 1
        raise ValueError("Service unavailable")

    # Act
    with pytest.raises(ValueError):
        faulty_init()
    assert call_count == 1, "The function was not called on the first attempt."

    with pytest.raises(ValueError):
        faulty_init()

    # Assert
    assert call_count == 2, "Function did not re-run after failure."
