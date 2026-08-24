import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dropdown } from '@/components/ui/Dropdown';
import { useToast } from '@/components/ui/Toast';
import { Mail, Plus, Filter, MoreHorizontal, Layers, CheckCircle2 } from 'lucide-react';

export const ComponentShowcasePage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { toast } = useToast();

  return (
    <MainLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            <h1 className="text-xl font-bold text-surface-900 tracking-tight">Design System & Core UI Showcase</h1>
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Enterprise design tokens, light mode crisp aesthetics, 12px border radius, and reusable components.
          </p>
        </div>

        {/* Buttons Showcase */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Button System</CardTitle>
            <CardDescription>Primary, Secondary, Outline, Ghost, Danger and Loading states</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Action</Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="primary" isLoading>
                Loading
              </Button>
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                With Icon
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="sm" variant="primary">Small (h-8)</Button>
              <Button size="md" variant="primary">Medium (h-9)</Button>
              <Button size="lg" variant="primary">Large (h-11)</Button>
            </div>
          </CardContent>
        </Card>

        {/* Inputs Showcase */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Form Inputs</CardTitle>
            <CardDescription>Input fields with labels, icons, error states, and helper text</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Client Name" placeholder="e.g. Acme Corporation" />
            <Input label="Email Address" leftIcon={<Mail className="w-4 h-4" />} placeholder="admin@acme.com" />
            <Input label="Validation Error" error="This field is required and must be valid" placeholder="Invalid input" />
            <Input label="Helper Info" helperText="Used for official invoicing notifications" placeholder="Details..." />
          </CardContent>
        </Card>

        {/* Badges Showcase */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Badges & Status Indicators</CardTitle>
            <CardDescription>Visual tags for roles, deal stages, and statuses</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant="default">Default Gray</Badge>
            <Badge variant="primary">Primary Blue</Badge>
            <Badge variant="success">Success Emerald</Badge>
            <Badge variant="warning">Warning Amber</Badge>
            <Badge variant="danger">Danger Rose</Badge>
            <Badge variant="info">Info Sky</Badge>
          </CardContent>
        </Card>

        {/* Overlays & Interactive Components */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Overlays & Interactive Components</CardTitle>
            <CardDescription>Modals, Drawers, Dropdowns, and Toast triggers</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
              Open Modal
            </Button>
            <Button variant="outline" onClick={() => setIsDrawerOpen(true)}>
              Open Side Drawer
            </Button>
            <Button variant="secondary" onClick={() => toast('Notification', 'Toast notification triggered successfully', 'success')}>
              Trigger Success Toast
            </Button>
            <Button variant="secondary" onClick={() => toast('Error Warning', 'Failed to perform operation', 'error')}>
              Trigger Error Toast
            </Button>

            <Dropdown
              trigger={
                <Button variant="outline" rightIcon={<MoreHorizontal className="w-4 h-4" />}>
                  Action Menu
                </Button>
              }
              items={[
                { id: '1', label: 'Edit Entity', onClick: () => toast('Action', 'Edit selected', 'info') },
                { id: '2', label: 'Duplicate Entry', onClick: () => toast('Action', 'Duplicated', 'info') },
                { id: '3', label: 'Delete Entity', danger: true, onClick: () => toast('Delete', 'Deleted', 'error') },
              ]}
            />
          </CardContent>
        </Card>

        {/* Skeletons & Empty States */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="md">
            <CardHeader>
              <CardTitle>Skeleton Loaders</CardTitle>
              <CardDescription>Smooth pulse loaders during async data fetch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex items-center gap-3 pt-2">
                <Skeleton variant="circular" className="w-10 h-10" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </CardContent>
          </Card>

          <EmptyState
            title="No Consultant Tasks Assigned"
            description="All milestone deliverables for this quarter have been completed."
            actionLabel="Create Milestone"
            onAction={() => toast('Action', 'Create milestone clicked', 'info')}
          />
        </div>

        {/* Modal Demo */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Consulting Engagement"
          description="Fill out the agenda scope details below to initialize the contract."
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
                Confirm & Create
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input label="Engagement Title" placeholder="e.g. Enterprise Security Audit" />
            <Input label="Target Client" placeholder="Select organization..." />
          </div>
        </Modal>

        {/* Drawer Demo */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Consultant Profile Details"
          description="Comprehensive audit record & billable history"
          footer={
            <Button variant="primary" size="sm" onClick={() => setIsDrawerOpen(false)}>
              Close Panel
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-surface-50 rounded-lg border border-surface-100">
              <span className="font-semibold text-surface-900 block">Senior Principal Architect</span>
              <span className="text-surface-500">Billable Rate: $250 / hour</span>
            </div>
            <p className="text-surface-600">
              Specialized in cloud architecture, async microservices with FastAPI & Python, enterprise database normalization, and frontend performance tuning.
            </p>
          </div>
        </Drawer>
      </div>
    </MainLayout>
  );
};
