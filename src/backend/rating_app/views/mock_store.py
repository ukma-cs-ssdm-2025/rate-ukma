from datetime import datetime, timedelta

STATUS_ENUM = ["PLANNED", "ACTIVE", "FINISHED"]
TYPE_ENUM = ["COMPULSORY", "ELECTIVE"]

# Courses

MOCK_COURSES = [
    {
        "id": "3d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "code": "424242",
        "title": "Computer Architecture",
        "description": "Detailed look into computer hardware, caching, and pipelining.",
        "status": "ACTIVE",
        "type_kind": "COMPULSORY",
        "faculty_id": "1d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "department_id": "2d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "specialities": ["9k1138dd-e711-4019-8eb9-aadc5d3ac484"],
    },
    {
        "id": "1o1138dd-e711-4019-8eb9-aadc2d3ac484",
        "code": "199999",
        "title": "Witchcraft",
        "description": "A creative elective exploring magical realism and folklore.",
        "status": "PLANNED",
        "type_kind": "ELECTIVE",
        "faculty_id": "5a1138dd-e711-4019-8eb9-aadc2d3ac484",
        "department_id": "5b1138dd-e711-4019-8eb9-aadc2d3ac484",
        "specialities": ["1p1138dd-e711-4019-8eb9-aadc2d3ac484"],
    },
    {
        "id": "8f1138dd-e711-4019-8eb9-aadc2d3ac484",
        "code": "111111",
        "title": "Linear Algebra II",
        "description": "Advanced linear transformations, eigenvalues, and matrix factorizations.",
        "status": "ACTIVE",
        "type_kind": "COMPULSORY",
        "faculty_id": "1d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "department_id": "2d1138dd-e711-4019-8eb9-aadc2d3ac999",
        "specialities": ["9k1138dd-e711-4019-8eb9-aadc5d3ac999"],
    },
    {
        "id": "2b1138dd-e711-4019-8eb9-aadc2d3ac484",
        "code": "555555",
        "title": "Philosophy of AI",
        "description": (
            "Explores ethical and philosophical questions behind artificial intelligence."
        ),
        "status": "ACTIVE",
        "type_kind": "ELECTIVE",
        "faculty_id": "7c1138dd-e711-4019-8eb9-aadc2d3ac484",
        "department_id": "7d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "specialities": ["7f1138dd-e711-4019-8eb9-aadc2d3ac484"],
    },
    {
        "id": "9a1138dd-e711-4019-8eb9-aadc2d3ac484",
        "code": "343434",
        "title": "Data Structures",
        "description": ("Covers efficient algorithms for storing and manipulating data."),
        "status": "FINISHED",
        "type_kind": "COMPULSORY",
        "faculty_id": "1d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "department_id": "3e1138dd-e711-4019-8eb9-aadc2d3ac484",
        "specialities": ["8g1138dd-e711-4019-8eb9-aadc2d3ac484"],
    },
    {
        "id": "7e1138dd-e711-4019-8eb9-aadc2d3ac484",
        "code": "777777",
        "title": "Contemporary Art and Technology",
        "description": (
            "Explores intersections of media, digital art and human-computer expression."
        ),
        "status": "PLANNED",
        "type_kind": "ELECTIVE",
        "faculty_id": "4x1138dd-e711-4019-8eb9-aadc2d3ac484",
        "department_id": "4y1138dd-e711-4019-8eb9-aadc2d3ac484",
        "specialities": ["4z1138dd-e711-4019-8eb9-aadc2d3ac484"],
    },
]

# ratings
MOCK_RATINGS = [
    # Computer Architecture
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac484",
        "student": "00000000-0000-0000-0000-000000000001",
        "course": "3d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 4,
        "usefulness": 5,
        "comment": "Great explanations, but labs are tough.",
        "created_at": datetime.now() - timedelta(days=3),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac485",
        "student": "00000000-0000-0000-0000-000000000002",
        "course": "3d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 3,
        "usefulness": 4,
        "comment": "Solid course overall, wish there were more examples.",
        "created_at": datetime.now() - timedelta(days=10),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac487",
        "student": "00000000-0000-0000-0000-000000000003",
        "course": "3d1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 5,
        "usefulness": 5,
        "comment": "Fantastic course, really well structured.",
        "created_at": datetime.now() - timedelta(days=15),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac488",  # Witchcraft
        "student": "00000000-0000-0000-0000-000000000004",
        "course": "1o1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 2,
        "usefulness": 3,
        "comment": "Weird but kind of fun.",
        "created_at": datetime.now() - timedelta(days=20),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac489",
        "student": "00000000-0000-0000-0000-000000000005",
        "course": "1o1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 5,
        "usefulness": 1,
        "comment": "Absolutely chaotic, but hilarious.",
        "created_at": datetime.now() - timedelta(days=5),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac490",  # Linear Algebra II
        "student": "00000000-0000-0000-0000-000000000006",
        "course": "8f1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 5,
        "usefulness": 5,
        "comment": "Hard, but rewarding if you love math.",
        "created_at": datetime.now() - timedelta(days=12),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac491",
        "student": "00000000-0000-0000-0000-000000000007",
        "course": "8f1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 4,
        "usefulness": 4,
        "comment": "A lot of theory. Could use more exercises.",
        "created_at": datetime.now() - timedelta(days=8),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac492",  # Philosophy of AI
        "student": "00000000-0000-0000-0000-000000000008",
        "course": "2b1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 3,
        "usefulness": 5,
        "comment": "Blew my mind! Amazing discussions.",
        "created_at": datetime.now() - timedelta(days=6),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac493",
        "student": "00000000-0000-0000-0000-000000000009",
        "course": "2b1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 2,
        "usefulness": 4,
        "comment": "A bit abstract, but interesting.",
        "created_at": datetime.now() - timedelta(days=13),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac494",  # Data Structures
        "student": "00000000-0000-0000-0000-000000000010",
        "course": "9a1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 4,
        "usefulness": 5,
        "comment": "One of the most important courses in CS.",
        "created_at": datetime.now() - timedelta(days=1),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac495",
        "student": "00000000-0000-0000-0000-000000000011",
        "course": "9a1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 3,
        "usefulness": 5,
        "comment": "Excellent professor, clear explanations.",
        "created_at": datetime.now() - timedelta(days=2),
    },
    {
        "id": "7a1138dd-e711-4019-8eb9-aadc2d3ac496",  # Contemporary Art
        "student": "00000000-0000-0000-0000-000000000012",
        "course": "7e1138dd-e711-4019-8eb9-aadc2d3ac484",
        "difficulty": 1,
        "usefulness": 3,
        "comment": "Relaxing class, but not much depth.",
        "created_at": datetime.now() - timedelta(days=9),
    },
]


# CRUD helpers
def list_ratings(course_id=None, user_id=None):
    data = MOCK_RATINGS
    if course_id:
        data = [r for r in data if str(r["course"]) == str(course_id)]
    if user_id:
        data = [r for r in data if str(r["student"]) == str(user_id)]
    return data


def create_rating(validated):
    new_id = f"auto-{len(MOCK_RATINGS) + 1:04d}-0000-0000-0000-000000000000"
    item = {**validated, "id": new_id, "created_at": datetime.now()}
    MOCK_RATINGS.append(item)
    return item


def get_rating(pk):
    return next((r for r in MOCK_RATINGS if str(r["id"]) == str(pk)), None)


def update_rating(pk, validated):
    for i, r in enumerate(MOCK_RATINGS):
        if str(r["id"]) == str(pk):
            MOCK_RATINGS[i] = {**r, **validated}
            return MOCK_RATINGS[i]
    return None


def delete_rating(pk):
    before = len(MOCK_RATINGS)
    MOCK_RATINGS[:] = [r for r in MOCK_RATINGS if str(r["id"]) != str(pk)]
    return len(MOCK_RATINGS) < before
