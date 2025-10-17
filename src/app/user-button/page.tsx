import { ClerkLoaded, ClerkLoading, UserButton } from '@clerk/nextjs';

export default function UserButtonPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <ClerkLoading>
        <div>Loading...</div>
      </ClerkLoading>
      <ClerkLoaded>
        <UserButton />
      </ClerkLoaded>
    </div>
  );
}