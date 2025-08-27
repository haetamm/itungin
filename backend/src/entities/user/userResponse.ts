import { UserAndRoles } from '../../utils/interface';

class UserResponse {
  static convert({
    id,
    name,
    imageUrl,
    username,
    createdAt,
    updatedAt,
    userRoles,
  }: UserAndRoles) {
    return {
      id,
      name,
      imageUrl,
      username,
      role: userRoles.length > 0 ? userRoles[0].role.role : null,
      createdAt,
      updatedAt,
    };
  }
}

export default UserResponse;
