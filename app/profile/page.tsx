'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface ProfileData {
    firstName: string;
    lastName: string;
    company: string;
    jobTitle: string;
    phone: string;
    bio: string;
    avatarUrl: string;
}

export default function ProfilePage() {
    const { user, isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const [profileData, setProfileData] = useState<ProfileData>({
        firstName: '',
        lastName: '',
        company: '',
        jobTitle: '',
        phone: '',
        bio: '',
        avatarUrl: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login?redirect=/profile');
        }
    }, [isAuthenticated, loading, router]);

    // Fetch profile data when component mounts
    useEffect(() => {
        if (isAuthenticated && user) {
            fetchProfileData();
        }
    }, [isAuthenticated, user]);

    const fetchProfileData = async () => {
        try {
            const response = await fetch(`/api/profile?userId=${user?.attributes.sub}`);
            if (response.ok) {
                const data = await response.json();
                setProfileData(data);
            } else {
                // If no profile exists yet, we'll use the default empty state
                console.log('No profile data found or error fetching profile');
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching profile data:', error);
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const response = await fetch('/api/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.attributes.sub,
                    ...profileData
                }),
            });

            if (response.ok) {
                toast({
                    title: "Profile updated",
                    description: "Your profile information has been saved successfully.",
                });
            } else {
                throw new Error('Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            toast({
                title: "Error",
                description: "Failed to update profile. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Show loading state or the form if authenticated
    return (
        <main className="min-h-screen flex flex-col">
            <div className="flex-grow mx-auto max-w-screen-xl w-full px-4 py-8">
                {loading || isLoading ? (
                    <div className="flex items-center justify-center h-[60vh]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-lg">Loading...</p>
                        </div>
                    </div>
                ) : isAuthenticated ? (
                    <>
                        <div className="mb-8">
                            <h1 className="text-4xl font-bold tracking-tight">Your Profile</h1>
                            <p className="text-lg text-muted-foreground mt-2">
                                Manage your personal information and preferences
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Sidebar with user info */}
                            <div className="col-span-1">
                                <Card>
                                    <CardHeader className="text-center">
                                        <div className="flex justify-center mb-4">
                                            <Avatar className="h-24 w-24">
                                                <AvatarImage src={profileData.avatarUrl || undefined} alt={user?.username || "User"} />
                                                <AvatarFallback className="text-2xl">
                                                    {profileData.firstName && profileData.lastName
                                                        ? `${profileData.firstName[0]}${profileData.lastName[0]}`
                                                        : user?.username?.[0]?.toUpperCase() || "U"}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <CardTitle>{profileData.firstName && profileData.lastName
                                            ? `${profileData.firstName} ${profileData.lastName}`
                                            : user?.username || "User"}
                                        </CardTitle>
                                        <CardDescription>{user?.email || "No email provided"}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-center">
                                        {profileData.company && (
                                            <p className="text-sm text-muted-foreground">{profileData.jobTitle} at {profileData.company}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Main content */}
                            <div className="col-span-1 md:col-span-2">
                                <Tabs defaultValue="personal">
                                    <TabsList className="mb-6">
                                        <TabsTrigger value="personal">Personal Information</TabsTrigger>
                                        <TabsTrigger value="account">Account Settings</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="personal">
                                        <Card>
                                            <form onSubmit={handleSubmit}>
                                                <CardHeader>
                                                    <CardTitle>Personal Information</CardTitle>
                                                    <CardDescription>
                                                        Update your personal details and professional information
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="firstName">First Name</Label>
                                                            <Input
                                                                id="firstName"
                                                                name="firstName"
                                                                value={profileData.firstName}
                                                                onChange={handleInputChange}
                                                                placeholder="Enter your first name"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="lastName">Last Name</Label>
                                                            <Input
                                                                id="lastName"
                                                                name="lastName"
                                                                value={profileData.lastName}
                                                                onChange={handleInputChange}
                                                                placeholder="Enter your last name"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="company">Company</Label>
                                                            <Input
                                                                id="company"
                                                                name="company"
                                                                value={profileData.company}
                                                                onChange={handleInputChange}
                                                                placeholder="Enter your company name"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="jobTitle">Job Title</Label>
                                                            <Input
                                                                id="jobTitle"
                                                                name="jobTitle"
                                                                value={profileData.jobTitle}
                                                                onChange={handleInputChange}
                                                                placeholder="Enter your job title"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="phone">Phone Number</Label>
                                                        <Input
                                                            id="phone"
                                                            name="phone"
                                                            value={profileData.phone}
                                                            onChange={handleInputChange}
                                                            placeholder="Enter your phone number"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="avatarUrl">Profile Picture URL</Label>
                                                        <Input
                                                            id="avatarUrl"
                                                            name="avatarUrl"
                                                            value={profileData.avatarUrl}
                                                            onChange={handleInputChange}
                                                            placeholder="Enter URL for your profile picture"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="bio">Bio</Label>
                                                        <Textarea
                                                            id="bio"
                                                            name="bio"
                                                            value={profileData.bio}
                                                            onChange={handleInputChange}
                                                            placeholder="Tell us about yourself"
                                                            rows={4}
                                                        />
                                                    </div>
                                                </CardContent>
                                                <CardFooter>
                                                    <Button type="submit" disabled={isSaving}>
                                                        {isSaving ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            'Save Changes'
                                                        )}
                                                    </Button>
                                                </CardFooter>
                                            </form>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="account">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Account Settings</CardTitle>
                                                <CardDescription>
                                                    Manage your account settings and preferences
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-sm font-medium">Email Address</p>
                                                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">Account ID</p>
                                                        <p className="text-sm text-muted-foreground">{user?.attributes.sub}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">Email Verification Status</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {user?.attributes.email_verified ? 'Verified' : 'Not Verified'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                            <CardFooter className="flex flex-col items-start space-y-2">
                                                <Button variant="outline" onClick={() => router.push('/reset-password')}>
                                                    Change Password
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
            <Footer />
        </main>
    );
}
