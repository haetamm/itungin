import { UserAndRoles } from "../../utils/interface";

class UserResponse {
    static convert({
        id,
        name,
        imageUrl,
        username,
        createdAt,
        updatedAt,
        roleUser,
    }: UserAndRoles ) {
        return {
            id,
            name,
            imageUrl,
            username,
            role: roleUser.length > 0 ? roleUser[0].role.role : null,
            createdAt,
            updatedAt,
        };
    }
}

export default UserResponse;
