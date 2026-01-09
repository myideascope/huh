import React, { useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Save, FolderOpen, Trash2, Plus, Check } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PresetsPanel = () => {
    const { eqSettings, advancedSettings, loadPreset, addLog } = useAudioEngine();
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetDescription, setNewPresetDescription] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedPresetId, setSelectedPresetId] = useState(null);

    // Fetch presets from backend
    const fetchPresets = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API}/presets`);
            setPresets(response.data);
        } catch (err) {
            addLog('error', 'Failed to fetch presets', { error: err.message });
        } finally {
            setLoading(false);
        }
    }, [addLog]);

    useEffect(() => {
        fetchPresets();
    }, [fetchPresets]);

    // Save current settings as preset
    const savePreset = async () => {
        if (!newPresetName.trim()) {
            addLog('warning', 'Please enter a preset name');
            return;
        }

        try {
            const presetData = {
                name: newPresetName.trim(),
                description: newPresetDescription.trim(),
                equalizer: eqSettings,
                advanced: advancedSettings,
            };

            await axios.post(`${API}/presets`, presetData);
            addLog('success', `Saved preset: ${newPresetName}`);
            setNewPresetName('');
            setNewPresetDescription('');
            setDialogOpen(false);
            fetchPresets();
        } catch (err) {
            addLog('error', 'Failed to save preset', { error: err.message });
        }
    };

    // Load preset
    const handleLoadPreset = (preset) => {
        loadPreset(preset);
        setSelectedPresetId(preset.id);
        setTimeout(() => setSelectedPresetId(null), 1500);
    };

    // Delete preset
    const deletePreset = async (presetId, e) => {
        e.stopPropagation();
        try {
            await axios.delete(`${API}/presets/${presetId}`);
            addLog('info', 'Preset deleted');
            fetchPresets();
        } catch (err) {
            addLog('error', 'Failed to delete preset', { error: err.message });
        }
    };

    // Default presets
    const defaultPresets = [
        {
            id: 'default-flat',
            name: 'Flat',
            description: 'No adjustments',
            equalizer: { band_60hz: 0, band_230hz: 0, band_910hz: 0, band_3600hz: 0, band_14000hz: 0 },
            advanced: { noise_reduction: 0, voice_isolation: 0, gain: 1, highpass_enabled: false, highpass_frequency: 80, lowpass_enabled: false, lowpass_frequency: 16000 },
            isDefault: true,
        },
        {
            id: 'default-voice',
            name: 'Voice Clarity',
            description: 'Enhanced speech',
            equalizer: { band_60hz: -4, band_230hz: 2, band_910hz: 4, band_3600hz: 3, band_14000hz: -2 },
            advanced: { noise_reduction: 30, voice_isolation: 50, gain: 1.2, highpass_enabled: true, highpass_frequency: 100, lowpass_enabled: true, lowpass_frequency: 8000 },
            isDefault: true,
        },
        {
            id: 'default-boost',
            name: 'Distant Audio',
            description: 'Boost weak signals',
            equalizer: { band_60hz: -2, band_230hz: 3, band_910hz: 5, band_3600hz: 4, band_14000hz: 2 },
            advanced: { noise_reduction: 40, voice_isolation: 30, gain: 2.5, highpass_enabled: true, highpass_frequency: 80, lowpass_enabled: false, lowpass_frequency: 16000 },
            isDefault: true,
        },
    ];

    const allPresets = [...defaultPresets, ...presets];

    return (
        <div className="control-card space-y-4" data-testid="presets-panel">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Presets
                </h3>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            data-testid="save-preset-trigger-btn"
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            Save
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md" data-testid="save-preset-dialog">
                        <DialogHeader>
                            <DialogTitle>Save Preset</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="preset-name">Name</Label>
                                <Input
                                    id="preset-name"
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    placeholder="My Custom Preset"
                                    data-testid="preset-name-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="preset-description">Description (optional)</Label>
                                <Input
                                    id="preset-description"
                                    value={newPresetDescription}
                                    onChange={(e) => setNewPresetDescription(e.target.value)}
                                    placeholder="What's this preset for?"
                                    data-testid="preset-description-input"
                                />
                            </div>
                            <Button
                                onClick={savePreset}
                                className="w-full btn-primary"
                                data-testid="confirm-save-preset-btn"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save Preset
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <ScrollArea className="h-48" data-testid="presets-list">
                <div className="space-y-2 pr-4">
                    {loading ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                            Loading presets...
                        </div>
                    ) : (
                        allPresets.map((preset) => (
                            <div
                                key={preset.id}
                                onClick={() => handleLoadPreset(preset)}
                                className={`preset-card flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                                    selectedPresetId === preset.id
                                        ? 'bg-primary/10 border-primary/50'
                                        : 'bg-muted/30 border-border/30 hover:border-border'
                                }`}
                                data-testid={`preset-item-${preset.id}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">
                                            {preset.name}
                                        </span>
                                        {preset.isDefault && (
                                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                Default
                                            </span>
                                        )}
                                        {selectedPresetId === preset.id && (
                                            <Check className="w-4 h-4 text-primary" />
                                        )}
                                    </div>
                                    {preset.description && (
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {preset.description}
                                        </p>
                                    )}
                                </div>
                                {!preset.isDefault && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => deletePreset(preset.id, e)}
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                        data-testid={`delete-preset-${preset.id}`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default PresetsPanel;
