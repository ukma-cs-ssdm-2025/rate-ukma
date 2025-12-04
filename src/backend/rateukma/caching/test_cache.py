import json
from dataclasses import asdict, dataclass
from unittest.mock import Mock, patch
from urllib.parse import urlencode

from rest_framework.request import Request
from rest_framework.response import Response

import pytest
from pydantic import BaseModel

from rateukma.caching.cache_manager import ICacheManager, RedisCacheManager
from rateukma.caching.decorators import (
    invalidate_cache_for,
    rcached,
)
from rateukma.caching.types_extensions import (
    BaseModelCacheTypeExtension,
    DataclassCacheTypeExtension,
    DRFResponseCacheTypeExtension,
    PrimitiveCacheTypeExtension,
)


@pytest.fixture
def mock_redis_client():
    client = Mock()
    client.get.return_value = None
    client.setex.return_value = True
    client.set.return_value = True
    client.scan.return_value = (0, [])  # cursor=0 (done), keys=[]
    return client


@pytest.fixture
def cache_manager(mock_redis_client) -> ICacheManager:
    return RedisCacheManager(
        redis_client=mock_redis_client,
        key_prefix="test",
        default_ttl=300,
        ignore_exceptions=True,
    )


@pytest.mark.usefixtures("cache_manager", "mock_redis_client")
@pytest.mark.integration
class TestCachePrimitives:
    @pytest.mark.parametrize(
        "primitive_value, type",
        [
            (42, int),
            ("hello", str),
            (True, bool),
            (False, bool),
            ([1, 2, 3], list),
            ({"key": "value"}, dict),
        ],
    )
    def test_cache_primitives(self, primitive_value, type):
        # Arrange
        ext = PrimitiveCacheTypeExtension()

        # Act and Assert - serialize
        result = ext.serialize(primitive_value)
        assert result == primitive_value

        # Act and Assert - deserialize
        deserialized = ext.deserialize(result, type)
        assert deserialized == primitive_value


@pytest.mark.usefixtures("cache_manager", "mock_redis_client")
@pytest.mark.integration
class TestCacheDataclasses:
    @dataclass(frozen=True)
    class _TestData:
        name: str
        value: int
        active: bool = True

    def test_cache_dataclasses(self):
        # Arrange
        test_data = self._TestData(name="test", value=42, active=False)
        ext = DataclassCacheTypeExtension()

        # Act and Assert - serialize
        result = ext.serialize(test_data)
        expected = asdict(test_data)
        assert result == expected

        # Act and Assert - deserialize
        deserialized = ext.deserialize(result, self._TestData)
        assert isinstance(deserialized, self._TestData)
        assert deserialized.name == test_data.name
        assert deserialized.value == test_data.value
        assert deserialized.active == test_data.active

        # cache key generation
        cache_key = ext.get_cache_key(lambda: None, (), {})
        assert "lambda" in cache_key


@pytest.mark.usefixtures("cache_manager", "mock_redis_client")
@pytest.mark.integration
class TestCacheDRFResponses:
    @pytest.mark.parametrize(
        "response, expected_result",
        [
            (
                Response({"data": "test", "status": "ok"}),
                {"_wrapped": False, "data": "test", "status": "ok"},
            ),
            (Response(["item1", "item2"]), {"_wrapped": True, "data": ["item1", "item2"]}),
        ],
    )
    def test_cache_drf_responses(self, response, expected_result):
        # Arrange
        ext = DRFResponseCacheTypeExtension()

        mock_request = Mock(spec=Request)
        mock_request.method = "GET"
        mock_request.path = "/api/test"
        mock_request.query_params = {"param": "value"}

        # Act and Assert - serialize
        result = ext.serialize(response)
        assert result == expected_result

        # Act and Assert - deserialize
        deserialized = ext.deserialize(result, Response)
        assert isinstance(deserialized, Response)
        assert deserialized.data == response.data

        # Act and Assert - get cache key
        cache_key = ext.get_cache_key(lambda: None, (mock_request,), {})
        expected_func_pattern = (
            f"{mock_request.method}:{mock_request.path}?{urlencode(mock_request.query_params)}"
        )
        assert expected_func_pattern in cache_key


@pytest.mark.usefixtures("cache_manager", "mock_redis_client")
@pytest.mark.integration
class TestCacheBaseModels:
    class _TestModel(BaseModel):
        name: str
        count: int
        optional: str = "default"

    def test_cache_base_models(self):
        # Arrange
        ext = BaseModelCacheTypeExtension()
        instance = self._TestModel(name="test model", count=100, optional="custom")

        # Act and Assert - serialize
        result = ext.serialize(instance)
        expected = instance.model_dump()
        assert result == expected

        # Act and Assert - deserialize
        deserialized = ext.deserialize(result, self._TestModel)
        assert isinstance(deserialized, self._TestModel)
        assert deserialized.name == "test model"
        assert deserialized.count == 100
        assert deserialized.optional == "custom"

        # Act and Assert - get cache key
        cache_key = ext.get_cache_key(lambda: None, (), {"param": "value"})
        assert "param" in cache_key
        assert "value" in cache_key


@pytest.mark.integration
class TestRCachedComponents:
    @pytest.mark.parametrize(
        "primitive_value,expected_type",
        [
            (42, int),
            ("hello world", str),
            (True, bool),
            (False, bool),
            ([1, 2, 3], list),
            ({"key": "value"}, dict),
        ],
    )
    def test_rcached_decorator_with_primitives(
        self, cache_manager, mock_redis_client, primitive_value, expected_type
    ):
        with patch("rateukma.caching.decorators.redis_cache_manager", return_value=cache_manager):
            # Arrange
            @rcached(ttl=60, return_type=expected_type)
            def get_primitive():
                return primitive_value

            mock_redis_client.get.return_value = None  # Cache miss

            # Act and Assert - first call
            result1 = get_primitive()
            assert result1 == primitive_value
            assert mock_redis_client.setex.called

            # Arrange - reset mock for second call
            mock_redis_client.reset_mock()

            # Act and Assert - second call
            cached_data = json.dumps(primitive_value).encode()
            mock_redis_client.get.return_value = cached_data
            result2 = get_primitive()
            assert result2 == primitive_value

    def test_cache_key_generation(self):
        # Arrange
        ext = PrimitiveCacheTypeExtension()
        kwargs = {"param": "value"}
        args1 = (1,)
        args2 = (2,)

        # Act and Assert
        key1 = ext.get_cache_key(lambda x: x, args1, kwargs)
        key2 = ext.get_cache_key(lambda x: x, args1, kwargs)
        assert key1 == key2

        key3 = ext.get_cache_key(lambda x: x, args2, kwargs)
        assert key1 != key3

        # Assert cache key contains args and kwargs
        assert str(args1[0]) in key1
        for key, value in kwargs.items():
            assert f"{key}" in key1
            assert f"{value}" in key1


class TestCacheInvalidation:
    class _TestService:
        pass

    def test_invalidate_cache_with_custom_pattern(self, cache_manager, mock_redis_client):
        with (
            patch("rateukma.caching.decorators.redis_cache_manager", return_value=cache_manager),
            patch.object(cache_manager, "invalidate_pattern") as mock_invalidate,
        ):
            # Arrange
            return_value = "executed"
            pattern = "custom:*"

            @invalidate_cache_for(patterns=pattern)
            def test_operation():
                return return_value

            # Act
            result = test_operation()

            # Assert
            assert result == return_value
            mock_invalidate.assert_called_with(pattern)

    def test_invalidate_cache_with_method_name(self, cache_manager, mock_redis_client):
        service_instance = self._TestService()

        with (
            patch("rateukma.caching.decorators.redis_cache_manager", return_value=cache_manager),
            patch.object(cache_manager, "invalidate_pattern") as mock_invalidate,
        ):
            # Arrange
            return_value = "executed"
            method_name = "test_method"
            expected_pattern = f"*{service_instance.__class__.__name__}.{method_name}*"

            @invalidate_cache_for(method_name)
            def test_operation(self):
                return return_value

            # Act
            result = test_operation(service_instance)

            # Assert
            assert result == return_value
            mock_invalidate.assert_called_with(expected_pattern)

    def test_invalidate_cache_with_multiple_patterns(self, cache_manager, mock_redis_client):
        with (
            patch("rateukma.caching.decorators.redis_cache_manager", return_value=cache_manager),
            patch.object(cache_manager, "invalidate_pattern") as mock_invalidate,
        ):
            # Arrange
            return_value = "executed"
            patterns = ["pattern1:*", "pattern2:*", "*common*"]

            @invalidate_cache_for(patterns=patterns)
            def test_operation():
                return return_value

            # Act
            result = test_operation()

            # Assert
            assert result == return_value
            assert mock_invalidate.call_count == len(patterns)
            mock_invalidate.assert_any_call("pattern1:*")
            mock_invalidate.assert_any_call("pattern2:*")
            mock_invalidate.assert_any_call("*common*")
