import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const usersFilePath = path.join(process.cwd(), "data", "users.json");

async function ensureUsersFile() {
  const dirPath = path.dirname(usersFilePath);
  await fs.mkdir(dirPath, { recursive: true });
  try {
    await fs.access(usersFilePath);
  } catch {
    await fs.writeFile(usersFilePath, "[]", "utf8");
  }
}

export async function readUsers() {
  await ensureUsersFile();
  const content = await fs.readFile(usersFilePath, "utf8");
  const parsed = JSON.parse(content) as StoredUser[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeUsers(users: StoredUser[]) {
  await ensureUsersFile();
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const users = await readUsers();
  return users.find((user) => user.email === normalized);
}

export async function createUser(params: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const users = await readUsers();
  const newUser: StoredUser = {
    id: randomUUID(),
    name: params.name.trim(),
    email: normalizeEmail(params.email),
    passwordHash: params.passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  await writeUsers(users);
  return newUser;
}
