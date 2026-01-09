import React from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Mic, RefreshCw, Volume2 } from 'lucide-react';

const DeviceSelector = () => {
    const {
        devices,
        selectedDevice,
        setSelectedDevice,
        refreshDevices,
        isListening,
        inputLevel,
        error,
    } = useAudioEngine();

    const handleRefresh = async () => {
        await refreshDevices();
    };

    const getDeviceLabel = (device) => {
        if (device.label) return device.label;
        return `Microphone ${devices.indexOf(device) + 1}`;
    };

    const levelPercentage = Math.round(inputLevel * 100);
    const levelColor = levelPercentage > 80 ? 'bg-destructive' : levelPercentage > 50 ? 'bg-accent' : 'bg-primary';

    return (
        <div className="control-card space-y-4" data-testid="device-selector">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Input Device
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    className="h-8 w-8 p-0"
                    data-testid="refresh-devices-btn"
                >
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3" data-testid="device-error">
                    {error}
                </div>
            )}

            <Select
                value={selectedDevice || ''}
                onValueChange={setSelectedDevice}
                disabled={isListening}
                data-testid="device-select"
            >
                <SelectTrigger className="w-full bg-background border-border/50 hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="Select audio input..." />
                </SelectTrigger>
                <SelectContent>
                    {devices.map((device) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                            data-testid={`device-option-${device.deviceId}`}
                        >
                            {getDeviceLabel(device)}
                        </SelectItem>
                    ))}
                    {devices.length === 0 && (
                        <SelectItem value="none" disabled>
                            No devices found
                        </SelectItem>
                    )}
                </SelectContent>
            </Select>

            {/* Input Level Meter */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="label-text flex items-center gap-2">
                        <Volume2 className="w-3 h-3" />
                        Input Level
                    </span>
                    <span className="text-xs font-mono text-muted-foreground" data-testid="input-level-value">
                        {levelPercentage}%
                    </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full ${levelColor} transition-all duration-75 level-meter`}
                        style={{ width: `${levelPercentage}%` }}
                        data-testid="input-level-bar"
                    />
                </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <div
                    className={`status-dot ${
                        isListening
                            ? 'status-active'
                            : selectedDevice
                            ? 'status-inactive'
                            : 'status-error'
                    }`}
                    data-testid="status-indicator"
                />
                <span className="text-xs text-muted-foreground">
                    {isListening
                        ? 'Listening'
                        : selectedDevice
                        ? 'Ready'
                        : 'No device selected'}
                </span>
            </div>
        </div>
    );
};

export default DeviceSelector;
