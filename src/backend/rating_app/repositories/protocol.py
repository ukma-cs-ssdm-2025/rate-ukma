from typing import Literal, Protocol, TypeVar, overload

from rating_app.pagination import PaginationFilters, PaginationResult

T_DTO = TypeVar("T_DTO")  # Domain model type
T_ORM = TypeVar("T_ORM", covariant=True)  # ORM model type
T_Criteria = TypeVar("T_Criteria", contravariant=True)  # Filter criteria type
T_CreateData = TypeVar("T_CreateData", contravariant=True)  # Create/upsert input type


class IRepository(Protocol[T_DTO]):
    def get_all(self) -> list[T_DTO]: ...

    def get_by_id(self, id: str) -> T_DTO: ...

    def filter(self, **kwargs: object) -> list[T_DTO]: ...

    def get_or_create(self, data: T_DTO) -> tuple[T_DTO, bool]:
        # Get existing record or create new. Does NOT update existing records.
        ...

    def get_or_upsert(self, data: T_DTO) -> tuple[T_DTO, bool]:
        # Get existing record or create new. UPDATES existing records with provided data.
        ...

    def update(self, obj: T_DTO, **kwargs: object) -> T_DTO: ...

    def delete(self, id: str) -> None: ...


class IDomainOrmRepository(Protocol[T_DTO, T_ORM]):
    """
    Repository protocol supporting both domain model and ORM model returns.

    Use when repository needs to return ORM models for M2M relation operations
    (e.g., in database injectors) while normally returning domain models.
    """

    def get_all(self) -> list[T_DTO]: ...

    def get_by_id(self, id: str) -> T_DTO: ...

    def filter(self, **kwargs: object) -> list[T_DTO]: ...

    @overload
    def get_or_create(
        self, data: T_DTO, *, return_model: Literal[False] = ...
    ) -> tuple[T_DTO, bool]: ...

    @overload
    def get_or_create(self, data: T_DTO, *, return_model: Literal[True]) -> tuple[T_ORM, bool]: ...

    def get_or_create(
        self, data: T_DTO, *, return_model: bool = False
    ) -> tuple[T_DTO, bool] | tuple[T_ORM, bool]:
        # Get existing record or create new. Does NOT update existing records.
        ...

    @overload
    def get_or_upsert(
        self, data: T_DTO, *, return_model: Literal[False] = ...
    ) -> tuple[T_DTO, bool]: ...

    @overload
    def get_or_upsert(self, data: T_DTO, *, return_model: Literal[True]) -> tuple[T_ORM, bool]: ...

    def get_or_upsert(
        self, data: T_DTO, *, return_model: bool = False
    ) -> tuple[T_DTO, bool] | tuple[T_ORM, bool]:
        # Get existing record or create new. UPDATES existing records with provided data.
        ...

    def update(self, obj: T_DTO, **kwargs: object) -> T_DTO: ...

    def delete(self, id: str) -> None: ...


class IPaginatedRepository(Protocol[T_DTO, T_ORM, T_Criteria, T_CreateData]):
    """
    Repository protocol for entities with pagination and criteria-based filtering.

    Use for repositories that need:
    - Paginated filter results
    - Domain-specific filter criteria
    - ORM model returns for M2M operations
    - Separate create data type (e.g., RatingCreateParams vs RatingDTO)

    Note: update() is not part of this protocol as update semantics vary by domain.
    """

    def get_all(self) -> list[T_DTO]: ...

    def get_by_id(self, id: str) -> T_DTO: ...

    @overload
    def filter(
        self,
        criteria: T_Criteria,
        pagination: PaginationFilters,
    ) -> PaginationResult[T_DTO]: ...

    @overload
    def filter(
        self,
        criteria: T_Criteria,
        pagination: None = ...,
    ) -> list[T_DTO]: ...

    def filter(
        self,
        criteria: T_Criteria,
        pagination: PaginationFilters | None = None,
    ) -> PaginationResult[T_DTO] | list[T_DTO]: ...

    @overload
    def get_or_create(
        self, data: T_CreateData, *, return_model: Literal[False] = ...
    ) -> tuple[T_DTO, bool]: ...

    @overload
    def get_or_create(
        self, data: T_CreateData, *, return_model: Literal[True]
    ) -> tuple[T_ORM, bool]: ...

    def get_or_create(
        self, data: T_CreateData, *, return_model: bool = False
    ) -> tuple[T_DTO, bool] | tuple[T_ORM, bool]: ...

    @overload
    def get_or_upsert(
        self, data: T_CreateData, *, return_model: Literal[False] = ...
    ) -> tuple[T_DTO, bool]: ...

    @overload
    def get_or_upsert(
        self, data: T_CreateData, *, return_model: Literal[True]
    ) -> tuple[T_ORM, bool]: ...

    def get_or_upsert(
        self, data: T_CreateData, *, return_model: bool = False
    ) -> tuple[T_DTO, bool] | tuple[T_ORM, bool]: ...

    def delete(self, id: str) -> None: ...
