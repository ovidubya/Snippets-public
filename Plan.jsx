import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronRight, BarChart3, CheckCircle2, AlertCircle, ArrowRight, Settings, Calculator, Save, Download, Upload, Copy, GripVertical, Link as LinkIcon, X, Home, AlertTriangle, CheckSquare, Square, UserCog, Layers, Clock, CalendarDays, ListTodo, Search, Eraser, Lock, Unlock, CalendarClock, FileText, Bug, Beaker, BookOpen, CheckSquare as TaskIcon, MoreHorizontal, Edit3 } from 'lucide-react';

// --- Utility Functions ---

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const addBusinessDays = (startDate, days) => {
  let count = 0;
  const curDate = new Date(startDate);
  if (isNaN(curDate.getTime())) return new Date();
  if (days <= 0) return curDate;
  while (count < days) {
    curDate.setDate(curDate.getDate() + 1);
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
  }
  return curDate;
};

const getBusinessDayDiff = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  // Normalize to midnight to avoid hour differences causing issues
  startDate.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);
  
  let count = 0;
  const curDate = new Date(startDate);
  if (endDate < startDate) return 0;
  
  while (curDate < endDate) {
    curDate.setDate(curDate.getDate() + 1);
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
  }
  return count;
};

// --- Advanced Scheduling Engine ---

const calculateSchedule = (approach, team, velocityPerSprint) => {
  // CONFIGURATION
  const POINTS_PER_DEV_PER_SPRINT = velocityPerSprint || 13;
  const WORKING_DAYS_PER_SPRINT = 10; 
  const BASE_DAILY_VELOCITY = POINTS_PER_DEV_PER_SPRINT / WORKING_DAYS_PER_SPRINT;

  // 1. Setup Data Structures
  const allStories = approach.epics.flatMap(e => e.stories.map(s => ({...s, epicId: e.id, epicName: e.name})));
  const storyMap = new Map(allStories.map(s => [s.id, s]));
  const epicDepMap = new Map(approach.epics.map(e => [e.id, e.dependencies || []]));
  const epicStoriesMap = new Map();
  approach.epics.forEach(e => epicStoriesMap.set(e.id, e.stories.map(s => s.id)));
  const epicDoneMap = new Map(approach.epics.map(e => [e.id, !!e.isDone]));

  // 2. Initialize Developers from Global Team
  const safeTeam = team && team.length > 0 ? team : [{ name: 'Default Dev', capacity: 100, restricted: false }];
  let devTimeline = safeTeam.map(d => ({
      ...d,
      nextFreeTime: 0,
      adjustedVelocity: BASE_DAILY_VELOCITY * (d.capacity / 100)
  }));

  const bundleAssignments = new Map(); 
  const storyStatus = new Map();
  const storyFinishTimes = new Map();
  const assignments = []; 

  let processedCount = 0;
  const totalCount = allStories.length;
  let maxDay = 0;

  // Initialize Done Items
  allStories.forEach(s => {
      const isEffectiveDone = s.isDone || epicDoneMap.get(s.epicId);
      if (isEffectiveDone) {
          storyStatus.set(s.id, 'done');
          storyFinishTimes.set(s.id, 0); 
          processedCount++;
      } else {
          storyStatus.set(s.id, 'pending');
      }
  });
  
  let iterations = 0; 
  const MAX_ITERATIONS = 3000;

  while (processedCount < totalCount && iterations < MAX_ITERATIONS) {
    iterations++;

    const readyStories = allStories.filter(s => {
      if (storyStatus.get(s.id) !== 'pending') return false;
      const storyDeps = s.dependencies || [];
      if (!storyDeps.every(depId => !storyMap.has(depId) || storyStatus.get(depId) === 'done')) return false;
      const myEpicDeps = epicDepMap.get(s.epicId) || [];
      if (!myEpicDeps.every(depEpicId => {
         const blockingStories = epicStoriesMap.get(depEpicId) || [];
         return blockingStories.every(bsId => storyStatus.get(bsId) === 'done');
      })) return false;
      return true;
    });

    if (readyStories.length === 0 && processedCount < totalCount) break; 

    // Sort by Points
    readyStories.sort((a, b) => (parseFloat(b.points) || 0) - (parseFloat(a.points) || 0));

    let workAssigned = false;

    for (const story of readyStories) {
      const points = parseFloat(story.points) || 0;
      const bundleId = story.bundleId ? String(story.bundleId).trim() : null;
      
      // Determine Candidates
      let candidates = safeTeam.map((d, i) => ({ idx: i, restricted: !!d.restricted }))
                           .filter(x => !x.restricted)
                           .map(x => x.idx);

      if (bundleId && bundleId !== "") {
          if (bundleAssignments.has(bundleId)) {
              candidates = [bundleAssignments.get(bundleId)];
          } else {
              const targetDevIdx = safeTeam.findIndex(d => d.name.trim().toLowerCase() === bundleId.toLowerCase());
              if (targetDevIdx !== -1) {
                  candidates = [targetDevIdx];
              }
          }
      }

      let chosenDevIndex = -1;
      let earliestStartTime = Infinity;

      for (let idx of candidates) {
          const dev = devTimeline[idx];
          
          // Constraint 1: Dependencies
          let depConstraintTime = 0;
          (story.dependencies || []).forEach(dId => {
             if (storyFinishTimes.has(dId)) depConstraintTime = Math.max(depConstraintTime, storyFinishTimes.get(dId));
          });
          (epicDepMap.get(story.epicId) || []).forEach(eId => {
             (epicStoriesMap.get(eId) || []).forEach(sId => {
                 if (storyFinishTimes.has(sId)) depConstraintTime = Math.max(depConstraintTime, storyFinishTimes.get(sId));
             });
          });

          // Constraint 2: Blocked Until Date
          let blockedUntilOffset = 0;
          if (story.blockedUntil && approach.startDate) {
              blockedUntilOffset = getBusinessDayDiff(new Date(approach.startDate), new Date(story.blockedUntil));
              if (blockedUntilOffset < 0) blockedUntilOffset = 0;
          }

          const effectiveConstraint = Math.max(depConstraintTime, blockedUntilOffset);
          const potentialStart = Math.max(dev.nextFreeTime, effectiveConstraint);

          if (potentialStart < earliestStartTime) {
              earliestStartTime = potentialStart;
              chosenDevIndex = idx;
          }
      }

      if (chosenDevIndex !== -1) {
          const dev = devTimeline[chosenDevIndex];
          if (bundleId && bundleId !== "" && !bundleAssignments.has(bundleId)) {
              bundleAssignments.set(bundleId, chosenDevIndex);
          }

          const velocity = Math.max(0.01, dev.adjustedVelocity);
          const effortDuration = points / velocity;
          const minDuration = parseFloat(story.minDays) || 0;
          
          let actualStartTime = earliestStartTime;
          if (points <= POINTS_PER_DEV_PER_SPRINT) {
              const currentSprintIndex = Math.floor(actualStartTime / WORKING_DAYS_PER_SPRINT);
              const currentSprintEndDay = (currentSprintIndex + 1) * WORKING_DAYS_PER_SPRINT;
              if (actualStartTime + effortDuration > currentSprintEndDay) {
                   actualStartTime = currentSprintEndDay;
              }
          }
          
          const devFinishTime = actualStartTime + effortDuration;
          const storyDoneTime = actualStartTime + Math.max(effortDuration, minDuration);

          devTimeline[chosenDevIndex].nextFreeTime = devFinishTime;
          storyFinishTimes.set(story.id, storyDoneTime);
          storyStatus.set(story.id, 'done');
          
          assignments.push({
              storyId: story.id,
              storyName: story.name,
              epicName: story.epicName,
              devIndex: chosenDevIndex,
              devName: safeTeam[chosenDevIndex].name,
              startDay: actualStartTime,
              endDay: devFinishTime, 
              completeDay: storyDoneTime, 
              points: points
          });

          if (storyDoneTime > maxDay) maxDay = storyDoneTime;
          workAssigned = true;
          processedCount++;
          break; 
      }
    }
    if (!workAssigned && processedCount < totalCount) break; 
  }

  return {
    totalDays: maxDay,
    hasCircularDependency: processedCount < totalCount,
    assignments: assignments
  };
};

const calculateStats = (approach, team, velocityPerSprint) => {
  const WORKING_DAYS_PER_SPRINT = 10; 

  const totalPoints = approach.epics.reduce((acc, epic) => {
    if (epic.isDone) return acc; 
    const epicPoints = epic.stories.reduce((sAcc, story) => {
        if (story.isDone) return sAcc;
        return sAcc + (parseFloat(story.points) || 0);
    }, 0);
    return acc + epicPoints;
  }, 0);

  const schedule = calculateSchedule(approach, team, velocityPerSprint);
  const daysToComplete = Math.ceil(schedule.totalDays);
  const sprintCount = parseFloat((schedule.totalDays / WORKING_DAYS_PER_SPRINT).toFixed(1)); 
  const projectedEndDate = addBusinessDays(approach.startDate, daysToComplete);

  const targetDateObj = new Date(approach.targetDate);
  const isAtRisk = projectedEndDate > targetDateObj;
  
  return {
    totalPoints,
    projectedEndDate,
    sprintCount,
    isAtRisk,
    hasCircularDependency: schedule.hasCircularDependency,
    activeDevCount: team.length,
    assignments: schedule.assignments 
  };
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', size = 'md', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 shadow-sm",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500 border border-transparent",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  };
  const sizes = { xs: "px-2 py-1 text-xs", sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  return <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
};

const Input = ({ label, type = "text", value, onChange, className = "", min, ...props }) => (
  <div className={`flex flex-col ${className}`}>
    {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>}
    <input type={type} value={value} onChange={onChange} min={min} className="block w-full rounded-md border-gray-300 bg-gray-50 border p-2 text-sm focus:border-blue-500 focus:ring-blue-500" {...props} />
  </div>
);

// --- Sub-Components ---

const StoryTypeIcon = ({ type }) => {
    switch (type) {
        case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
        case 'spike': return <Beaker className="w-4 h-4 text-purple-500" />;
        case 'discovery': return <Search className="w-4 h-4 text-blue-500" />;
        case 'task': return <CheckSquare className="w-4 h-4 text-gray-500" />;
        default: return <BookOpen className="w-4 h-4 text-green-600" />; // story
    }
};

const StoryRow = ({ 
    story, 
    epic, 
    approach, 
    handleDragStart, 
    handleDragOver, 
    handleDrop, 
    onUpdateStory, 
    onDeleteStory, 
    handleOpenStoryDeps, 
    isExpanded, 
    onToggleExpand 
}) => {
    return (
        <div 
            draggable 
            onDragStart={(e) => handleDragStart(e, 'story', story.id, epic.id)} 
            onDragOver={handleDragOver} 
            onDrop={(e) => handleDrop(e, 'story', story.id, epic.id)} 
            className={`border border-transparent hover:border-gray-200 hover:shadow-sm rounded-md transition-all ${story.isDone || epic.isDone ? 'opacity-60 bg-gray-50/50' : 'bg-white'}`}
        >
            {/* Primary Row */}
            <div className="flex items-center gap-3 p-2 -mx-1">
                <div className="flex items-center w-full sm:w-auto flex-1 gap-2">
                    <div className="cursor-move text-gray-300 hover:text-gray-500"><GripVertical className="w-4 h-4" /></div>
                    <button onClick={() => onUpdateStory(approach.id, epic.id, story.id, 'isDone', !story.isDone)} className="text-gray-300 hover:text-blue-600 transition-colors" disabled={epic.isDone}>
                        {story.isDone || epic.isDone ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                    
                    {/* Type Indicator (Click to cycle or open edit) */}
                    <div className="flex-shrink-0" title={story.type || 'story'}>
                        <StoryTypeIcon type={story.type} />
                    </div>

                    <div className="flex-1 min-w-0 mr-2">
                        <input 
                            value={story.name} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'name', e.target.value)} 
                            className={`w-full text-sm border-b border-transparent focus:border-blue-300 focus:outline-none px-1 py-0.5 ${story.isDone || epic.isDone ? 'text-gray-500 line-through' : 'text-gray-700'}`} 
                            placeholder="Story name..." 
                        />
                        {/* Compact Indicators */}
                        <div className="flex items-center gap-3 mt-1 h-4">
                             {story.dependencies && story.dependencies.length > 0 && (
                                <div className="flex items-center gap-1"><LinkIcon className="w-3 h-3 text-orange-400" /><span className="text-[10px] text-gray-500 truncate">Depends on {story.dependencies.length}</span></div>
                             )}
                             {story.blockedUntil && (
                                <div className="flex items-center gap-1"><CalendarClock className="w-3 h-3 text-red-400" /><span className="text-[10px] text-red-500 truncate">Blocked: {formatDate(story.blockedUntil)}</span></div>
                             )}
                             {story.bundleId && <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0 rounded text-[10px] text-gray-600 font-medium"><Layers className="w-3 h-3 text-gray-500" />{story.bundleId}</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {/* Points Input */}
                    <div className="w-14">
                        <input 
                            type="number" 
                            min="0" 
                            value={story.points} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'points', parseFloat(e.target.value))} 
                            className="w-full text-sm text-right border rounded px-1 py-1 focus:border-blue-500 font-medium" 
                            placeholder="Pts"
                        />
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => onToggleExpand(story.id)} className={`p-1.5 rounded transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'}`} title="Edit Details">
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleOpenStoryDeps(story)} className={`p-1.5 rounded transition-colors ${story.dependencies?.length > 0 ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'}`} title="Dependencies">
                            <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteStory(approach.id, epic.id, story.id)} className="text-gray-300 hover:text-red-500 p-1.5" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Details Panel */}
            {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-md grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="col-span-1 sm:col-span-2">
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Description</label>
                        <textarea 
                            value={story.description || ''} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'description', e.target.value)} 
                            className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                            rows={2} 
                            placeholder="Add acceptance criteria or notes..." 
                        />
                    </div>
                    
                    <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Story Type</label>
                        <select 
                            value={story.type || 'story'} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'type', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="story">User Story</option>
                            <option value="task">Task / Chore</option>
                            <option value="bug">Bug Fix</option>
                            <option value="spike">Spike / Research</option>
                            <option value="discovery">Discovery</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Blocked Until</label>
                        <input 
                            type="date" 
                            value={story.blockedUntil || ''} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'blockedUntil', e.target.value)} 
                            className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>

                    <div>
                         <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Bundle ID / Developer</label>
                         <input 
                             value={story.bundleId || ''} 
                             onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'bundleId', e.target.value)} 
                             className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                             placeholder="e.g. 'Auth' or 'John'"
                         />
                    </div>

                    <div>
                         <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Wait Time (Days)</label>
                         <input 
                             type="number" 
                             min="0"
                             value={story.minDays || ''} 
                             onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'minDays', parseFloat(e.target.value))} 
                             className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                             placeholder="Minimum calendar days"
                         />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modals ---

const BreakdownModal = ({ isOpen, onClose, assignments, startDate, team }) => {
    if (!isOpen) return null;

    const WORKING_DAYS_PER_SPRINT = 10;
    const maxDay = assignments.reduce((acc, curr) => Math.max(acc, curr.endDay), 0);
    const numSprints = Math.max(1, Math.ceil(maxDay / WORKING_DAYS_PER_SPRINT));
    
    const sprints = [];
    for (let i = 0; i < numSprints; i++) {
        const sprintStartDay = i * WORKING_DAYS_PER_SPRINT;
        const sprintEndDay = (i + 1) * WORKING_DAYS_PER_SPRINT;
        const calStart = addBusinessDays(startDate, sprintStartDay);
        const calEnd = addBusinessDays(startDate, sprintEndDay); 

        const devWork = team.map(dev => {
            const relevantAssignments = assignments.filter(a => 
                a.devName === dev.name && 
                a.startDay < sprintEndDay && 
                a.endDay > sprintStartDay
            );

            let sprintTotalPoints = 0;
            const sprintStories = relevantAssignments.map(a => {
                const overlapStart = Math.max(a.startDay, sprintStartDay);
                const overlapEnd = Math.min(a.endDay, sprintEndDay);
                const totalDuration = a.endDay - a.startDay;
                
                let pointsInSprint = 0;
                
                if (totalDuration > 0) {
                    const overlapDuration = overlapEnd - overlapStart;
                    pointsInSprint = (overlapDuration / totalDuration) * a.points;
                } else {
                    if (a.startDay >= sprintStartDay && a.startDay < sprintEndDay) {
                        pointsInSprint = 0;
                    } else {
                        return null;
                    }
                }
                
                sprintTotalPoints += pointsInSprint;

                return {
                    ...a,
                    displayPoints: pointsInSprint,
                    isPartial: pointsInSprint < a.points && pointsInSprint > 0.01
                };
            }).filter(Boolean);

            return {
                dev: dev.name,
                stories: sprintStories,
                totalPoints: sprintTotalPoints
            };
        });

        sprints.push({
            index: i + 1,
            dateRange: `${formatDate(calStart)} - ${formatDate(calEnd)}`,
            devWork
        });
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><ListTodo className="w-5 h-5 text-blue-600" /> Sprint Breakdown</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto bg-gray-50/50 flex-1">
                    <div className="space-y-8">
                        {sprints.map(sprint => (
                            <div key={sprint.index} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">Sprint {sprint.index}</div>
                                        <div className="text-sm font-medium text-slate-600 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {sprint.dateRange}</div>
                                    </div>
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                                        Total: {sprint.devWork.reduce((acc, d) => acc + d.totalPoints, 0).toFixed(1)} pts
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {sprint.devWork.map(d => (
                                        <div key={d.dev} className="p-4 flex flex-col md:flex-row gap-4 hover:bg-slate-50 transition-colors">
                                            <div className="md:w-32 flex-shrink-0 flex md:flex-col items-center md:items-start justify-between">
                                                <div className="font-semibold text-sm text-gray-800">{d.dev}</div>
                                                <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{d.totalPoints.toFixed(1)} pts</div>
                                            </div>
                                            <div className="flex-1">
                                                {d.stories.length === 0 ? (
                                                    <span className="text-xs text-gray-400 italic">No work assigned</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {d.stories.map(story => (
                                                            <div key={story.storyId} className={`text-xs bg-white border rounded px-2 py-1.5 shadow-sm flex items-center gap-2 ${story.isPartial ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                                                                <span className="min-w-[1.25rem] h-5 flex items-center justify-center bg-white border border-gray-100 rounded-full text-[10px] font-bold text-gray-600 px-1">
                                                                    {story.displayPoints.toFixed(1)}
                                                                </span>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-gray-700 leading-tight">{story.storyName}</span>
                                                                    {story.isPartial && <span className="text-[9px] text-orange-500 font-bold leading-tight">PARTIAL</span>}
                                                                </div>
                                                                <span className="text-[9px] text-gray-400 uppercase tracking-wide bg-gray-50 px-1 rounded ml-auto">{story.epicName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {sprints.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <p>No active stories scheduled.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-6 py-4 bg-white border-t border-gray-200 text-right">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
};

const TeamModal = ({ isOpen, onClose, team, onChange, velocity, onVelocityChange }) => {
    if (!isOpen) return null;
    const updateDev = (id, field, val) => onChange(team.map(d => d.id === id ? { ...d, [field]: val } : d));
    const removeDev = (id) => onChange(team.filter(d => d.id !== id));
    const addDev = () => {
        const newId = Math.max(0, ...team.map(d => d.id)) + 1;
        onChange([...team, { id: newId, name: `Dev ${newId + 1}`, capacity: 100, restricted: false }]);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5" /> Global Team Management</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Base Velocity</label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="number" 
                                min="1" 
                                value={velocity} 
                                onChange={(e) => onVelocityChange(parseInt(e.target.value) || 1)}
                                className="w-20 border rounded px-3 py-2 text-sm font-bold text-center"
                            />
                            <span className="text-sm text-gray-600">Points per Developer / Sprint (10 days)</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {team.map((dev, idx) => (
                            <div key={dev.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase text-gray-400 font-bold">Name</label>
                                    <input value={dev.name} onChange={(e) => updateDev(dev.id, 'name', e.target.value)} className="w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm font-medium" />
                                </div>
                                <div className="w-24">
                                    <label className="text-[10px] uppercase text-gray-400 font-bold">Capacity %</label>
                                    <input type="number" min="0" max="100" value={dev.capacity} onChange={(e) => updateDev(dev.id, 'capacity', parseInt(e.target.value) || 0)} className="w-full border rounded px-2 py-1 text-sm" />
                                </div>
                                <div className="w-16 flex flex-col items-center">
                                    <label className="text-[10px] uppercase text-gray-400 font-bold mb-1">Restricted</label>
                                    <button 
                                        onClick={() => updateDev(dev.id, 'restricted', !dev.restricted)}
                                        className={`p-1.5 rounded transition-colors ${dev.restricted ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-gray-500'}`}
                                        title={dev.restricted ? "Restricted: Can ONLY work on Bundles assigned to their Name" : "Generalist: Can work on any story"}
                                    >
                                        {dev.restricted ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                    </button>
                                </div>
                                <button onClick={() => removeDev(dev.id)} className="text-gray-400 hover:text-red-500 pt-3"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addDev} className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                        <Plus className="w-4 h-4" /> Add Developer
                    </button>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-right"><Button onClick={onClose}>Done</Button></div>
            </div>
        </div>
    );
};

const DependencyModal = ({ 
  isOpen, 
  onClose, 
  item, 
  allItems, 
  onToggleDependency,
  onClearDependencies,
  title
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!isOpen || !item) return null;

  const currentDeps = item.dependencies || [];
  const availableItems = allItems.filter(i => i.id !== item.id);
  
  // Search Filter
  const filteredItems = availableItems.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.epicName && i.epicName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Grouping Logic
  const isStoryMode = !!item.epicId;
  let content;

  if (isStoryMode) {
      // Group stories by Epic
      const groups = filteredItems.reduce((acc, curr) => {
          const groupName = curr.epicName || "Other";
          if (!acc[groupName]) acc[groupName] = [];
          acc[groupName].push(curr);
          return acc;
      }, {});

      content = Object.entries(groups).map(([groupName, stories]) => (
          <div key={groupName} className="mb-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 px-1 bg-gray-50 py-1 rounded">{groupName}</h4>
              <div className="space-y-1">
                  {stories.map(target => {
                      const isSelected = currentDeps.includes(target.id);
                      return (
                          <div key={target.id} onClick={() => onToggleDependency(item.id, target.id)} className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                             <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>{isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                             <div className="flex-1">
                                <div className="text-sm font-medium text-gray-800">{target.name}</div>
                                {target.points && <div className="text-xs text-gray-500">{target.points} pts</div>}
                             </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      ));
  } else {
      // Flat list for Epics
      content = (
          <div className="space-y-1">
              {filteredItems.map(target => {
                   const isSelected = currentDeps.includes(target.id);
                   return (
                     <div key={target.id} onClick={() => onToggleDependency(item.id, target.id)} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>{isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                        <div className="flex-1">
                           <div className="text-sm font-medium text-gray-800">{target.name}</div>
                        </div>
                     </div>
                   );
              })}
          </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 truncate pr-4">{title}</h3>
          <div className="flex items-center gap-2">
            {currentDeps.length > 0 && (
                <button onClick={() => onClearDependencies(item.id)} className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1 mr-2">
                    <Eraser className="w-3 h-3" /> Clear All
                </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
        </div>
        
        <div className="px-4 py-2 border-b border-gray-100 bg-white">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search dependencies..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-gray-50/30">
          {availableItems.length === 0 ? (
             <div className="text-center text-gray-400 italic mt-8">No other items available to link.</div>
          ) : filteredItems.length === 0 ? (
             <div className="text-center text-gray-400 italic mt-8">No matches found.</div>
          ) : (
             content
          )}
        </div>
        <div className="px-6 py-4 bg-white border-t border-gray-200 text-right"><Button onClick={onClose} size="sm">Done</Button></div>
      </div>
    </div>
  );
};

// --- Main Views ---

const DashboardView = ({ 
  groups,
  team,
  velocity,
  onSelectApproach, 
  onDeleteApproach, 
  onCopyApproach, 
  onAddApproach,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onMoveGroup,
  onMoveStrategy,
  onImportClick,
  onExport,
  fileInputRef,
  onFileChange
}) => {

  const handleDragStart = (e, type, id, parentId) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, parentId }));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropType, dropId) => {
      e.preventDefault();
      try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          
          if (data.type === 'GROUP' && dropType === 'GROUP') {
              if (data.id !== dropId) onMoveGroup(data.id, dropId);
          } else if (data.type === 'STRATEGY') {
              if (dropType === 'GROUP') {
                  onMoveStrategy(data.parentId, data.id, dropId, null);
              }
          }
      } catch (err) {}
  };

  return (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div>
          <h2 className="text-3xl font-bold text-gray-900">Technical Strategies</h2>
          <p className="text-gray-500 mt-2">Manage and compare implementation bundles.</p>
      </div>
      <div className="flex gap-2">
          <Button onClick={onAddGroup} variant="primary" size="sm" className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Group</Button>
          <div className="h-8 w-px bg-gray-300 mx-2"></div>
          <Button onClick={onImportClick} variant="secondary" size="sm" className="flex items-center gap-2"><Upload className="w-4 h-4" /> Import</Button>
          <Button onClick={onExport} variant="secondary" size="sm" className="flex items-center gap-2"><Download className="w-4 h-4" /> Export</Button>
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".json" />
      </div>
    </div>

    {groups.map((group, gIdx) => (
        <div 
            key={group.id} 
            className="bg-gray-50/50 border border-gray-200 rounded-2xl p-6"
            draggable
            onDragStart={(e) => handleDragStart(e, 'GROUP', group.id, null)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'GROUP', group.id)}
        >
            <div className="flex justify-between items-center mb-6 cursor-move group-header">
                <div className="flex items-center gap-2 flex-1">
                    <GripVertical className="w-5 h-5 text-gray-300" />
                    <input 
                        value={group.name}
                        onChange={(e) => onUpdateGroup(group.id, 'name', e.target.value)}
                        className="text-xl font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors w-full"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onDeleteGroup(group.id)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>

            <div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[100px]"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                    e.stopPropagation();
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.type === 'STRATEGY') {
                        onMoveStrategy(data.parentId, data.id, group.id, null);
                    }
                }}
            >
                {group.strategies.map(approach => {
                    const stats = calculateStats(approach, team, velocity);
                    const borderColor = `border-${approach.color}-500`;
                    return (
                        <div 
                            key={approach.id} 
                            className={`bg-white rounded-xl shadow-sm border-t-8 ${borderColor} border-x border-b border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer relative group`} 
                            onClick={() => onSelectApproach(approach.id)}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, 'STRATEGY', approach.id, group.id); }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => {
                                e.stopPropagation();
                                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                if (data.type === 'STRATEGY') {
                                    onMoveStrategy(data.parentId, data.id, group.id, approach.id);
                                }
                            }}
                        >
                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                                <button onClick={(e) => onCopyApproach(e, group.id, approach.id)} className="p-2 bg-white rounded-full shadow-sm text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"><Copy className="w-3 h-3" /></button>
                                <button onClick={(e) => onDeleteApproach(e, group.id, approach.id)} className="p-2 bg-white rounded-full shadow-sm text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                            </div>
                            <div className="p-5">
                                <h3 className="font-bold text-gray-900 mb-2 pr-12 line-clamp-1">{approach.name}</h3>
                                <p className="text-sm text-gray-600 mb-4 h-24 overflow-hidden line-clamp-4">{approach.description}</p>
                                <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-3">
                                    <div className="text-center"><div className="text-[10px] text-gray-400 uppercase font-bold">Effort</div><div className="font-bold text-gray-800">{stats.totalPoints}</div></div>
                                    <div className="text-center"><div className="text-[10px] text-gray-400 uppercase font-bold">Sprints</div><div className="font-bold text-gray-800">{stats.sprintCount}</div></div>
                                    <div className="text-center"><div className="text-[10px] text-gray-400 uppercase font-bold">End</div><div className={`font-bold ${stats.isAtRisk ? 'text-red-600' : 'text-green-600'}`}>{formatDate(stats.projectedEndDate)}</div></div>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
                                    {stats.hasCircularDependency && <span className="text-amber-600 flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Loop</span>}
                                    {!stats.hasCircularDependency && stats.isAtRisk && <span className="text-red-600">Misses Deadline</span>}
                                    {!stats.hasCircularDependency && !stats.isAtRisk && <span className="text-green-600">On Target</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <button onClick={() => onAddApproach(group.id)} className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-6 text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all min-h-[200px]">
                    <Plus className="w-8 h-8 mb-2" />
                    <span className="text-sm font-medium">Add Strategy</span>
                </button>
            </div>
        </div>
    ))}
  </div>
  );
};

const DetailsView = ({
  approach,
  team,
  velocity,
  onUpdateApproach,
  onAddEpic,
  onToggleEpic,
  onUpdateEpicName,
  onDeleteEpic,
  onCopyEpic,
  onToggleEpicDone,
  onUpdateStory,
  onDeleteStory,
  onAddStory,
  onMoveStory,
  onMoveEpic,
  onUpdateEpicDependency
}) => {
  const [depModal, setDepModal] = useState({ open: false, type: 'story', item: null });
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [activeItemForDeps, setActiveItemForDeps] = useState(null);
  
  // Track expanded state for stories within this view
  const [expandedStoryIds, setExpandedStoryIds] = useState(new Set());
  
  if (!approach) return null;
  const stats = calculateStats(approach, team, velocity);
  const allStories = approach.epics.flatMap(e => e.stories.map(s => ({...s, epicName: e.name})));

  const handleOpenStoryDeps = (story) => { setActiveItemForDeps(story); setDepModal({ open: true, type: 'story', item: story }); };
  const handleOpenEpicDeps = (epic) => { setActiveItemForDeps(epic); setDepModal({ open: true, type: 'epic', item: epic }); };

  const handleToggleDependency = (itemId, dependencyId) => {
     const currentDeps = activeItemForDeps.dependencies || [];
     let newDeps = currentDeps.includes(dependencyId) ? currentDeps.filter(id => id !== dependencyId) : [...currentDeps, dependencyId];
     setActiveItemForDeps({...activeItemForDeps, dependencies: newDeps});
     if (depModal.type === 'story') {
        const epic = approach.epics.find(e => e.stories.some(s => s.id === itemId));
        if (epic) onUpdateStory(approach.id, epic.id, itemId, 'dependencies', newDeps);
     } else {
        onUpdateEpicDependency(approach.id, itemId, newDeps);
     }
  };

  const handleClearDependencies = (itemId) => {
     setActiveItemForDeps({...activeItemForDeps, dependencies: []});
     if (depModal.type === 'story') {
        const epic = approach.epics.find(e => e.stories.some(s => s.id === itemId));
        if (epic) onUpdateStory(approach.id, epic.id, itemId, 'dependencies', []);
     } else {
        onUpdateEpicDependency(approach.id, itemId, []);
     }
  };
  
  const toggleStoryExpand = (storyId) => {
      const newSet = new Set(expandedStoryIds);
      if (newSet.has(storyId)) newSet.delete(storyId);
      else newSet.add(storyId);
      setExpandedStoryIds(newSet);
  };

  const handleDragStart = (e, type, id, parentId) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, parentId })); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, dropType, dropTargetId, dropParentId) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'story' && dropType === 'story') onMoveStory(approach.id, data.parentId, data.id, dropParentId, dropTargetId);
      else if (data.type === 'story' && dropType === 'epic') onMoveStory(approach.id, data.parentId, data.id, dropTargetId, null);
      else if (data.type === 'epic' && dropType === 'epic' && data.id !== dropTargetId) onMoveEpic(approach.id, data.id, dropTargetId);
    } catch (err) {}
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
           <div className="mb-6 grid grid-cols-1 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strategy Name</label>
                <input type="text" value={approach.name} onChange={(e) => onUpdateApproach(approach.id, 'name', e.target.value)} className="text-2xl font-bold text-gray-900 w-full border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none placeholder-gray-300 pb-1" />
             </div>
             <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea value={approach.description} onChange={(e) => onUpdateApproach(approach.id, 'description', e.target.value)} className="w-full text-gray-600 rounded-md border-gray-300 border p-2 focus:ring-blue-500 focus:border-blue-500 text-sm" rows={2} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <select value={approach.color} onChange={(e) => onUpdateApproach(approach.id, 'color', e.target.value)} className="block w-full sm:w-32 rounded-md border-gray-300 border p-2 text-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="blue">Blue</option><option value="emerald">Green</option><option value="purple">Purple</option><option value="amber">Amber</option><option value="rose">Red</option><option value="gray">Gray</option>
                  </select>
               </div>
             </div>
           </div>

           <div className="flex justify-between items-end mb-4 pt-4 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-gray-500" /> Effort Breakdown</h3>
              <Button onClick={() => onAddEpic(approach.id)} size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2" /> Add Epic</Button>
           </div>

           <div className="space-y-4">
             {approach.epics.map(epic => (
               <div key={epic.id} className={`border rounded-lg overflow-hidden transition-all ${epic.isDone ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-200 bg-white'}`} draggable onDragStart={(e) => handleDragStart(e, 'epic', epic.id, null)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'epic', epic.id, null)}>
                  <div className={`px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b ${epic.isDone ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-100'}`} >
                     <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <div className="cursor-move text-gray-400 hover:text-gray-600"><GripVertical className="w-4 h-4" /></div>
                        <button onClick={(e) => { e.stopPropagation(); onToggleEpicDone(approach.id, epic.id); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                            {epic.isDone ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                        </button>
                        <button onClick={() => onToggleEpic(approach.id, epic.id)} className="text-gray-400 hover:text-gray-600">{epic.expanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}</button>
                        <div className="flex-1">
                            <input value={epic.name} onChange={(e) => onUpdateEpicName(approach.id, epic.id, e.target.value)} className={`bg-transparent font-semibold focus:outline-none focus:text-blue-600 w-full ${epic.isDone ? 'text-gray-500 line-through' : 'text-gray-700'}`} onClick={(e) => e.stopPropagation()} placeholder="Epic Name" />
                            {epic.dependencies && epic.dependencies.length > 0 && (
                                <div className="flex items-center gap-1 mt-0.5"><LinkIcon className="w-3 h-3 text-purple-500" /><span className="text-[10px] text-purple-600 font-medium">Waits for {epic.dependencies.length} epic{epic.dependencies.length > 1 ? 's' : ''}</span></div>
                            )}
                        </div>
                     </div>
                     <div className="flex items-center gap-2 ml-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded border whitespace-nowrap hidden sm:inline-block ${epic.isDone ? 'text-gray-400 bg-gray-100 border-gray-200' : 'text-gray-500 bg-white border-gray-200'}`}>
                           {epic.stories.reduce((acc, s) => { if (s.isDone || epic.isDone) return acc; return acc + (parseFloat(s.points)||0); }, 0)} pts left
                        </span>
                        <button onClick={() => handleOpenEpicDeps(epic)} className={`p-1.5 rounded transition-colors ${epic.dependencies?.length > 0 ? 'text-purple-600 bg-purple-50' : 'text-gray-400 hover:text-blue-500 hover:bg-white'}`}><LinkIcon className="w-4 h-4" /></button>
                        <button onClick={() => onCopyEpic(approach.id, epic.id)} className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-white transition-colors"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => onDeleteEpic(approach.id, epic.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                     </div>
                  </div>
                  {epic.expanded && (
                    <div className={`p-4 ${epic.isDone ? 'bg-gray-50' : 'bg-white'}`} onDragOver={handleDragOver} onDrop={(e) => { if (epic.stories.length === 0) handleDrop(e, 'story', null, epic.id); }}>
                       {epic.stories.length === 0 && <div className="text-center py-4 text-gray-400 text-sm italic border-2 border-dashed border-gray-100 rounded">No stories added yet. Drop items here.</div>}
                       <div className="space-y-2">
                          {epic.stories.map(story => (
                              <StoryRow 
                                key={story.id} 
                                story={story} 
                                epic={epic} 
                                approach={approach} 
                                handleDragStart={handleDragStart} 
                                handleDragOver={handleDragOver} 
                                handleDrop={handleDrop} 
                                onUpdateStory={onUpdateStory} 
                                onDeleteStory={onDeleteStory} 
                                handleOpenStoryDeps={handleOpenStoryDeps}
                                isExpanded={expandedStoryIds.has(story.id)}
                                onToggleExpand={toggleStoryExpand}
                              />
                          ))}
                       </div>
                       <div className="mt-4 pt-3 border-t border-gray-100"><button onClick={() => onAddStory(approach.id, epic.id)} className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center"><Plus className="w-3 h-3 mr-1" /> Add Story</button></div>
                    </div>
                  )}
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
             <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><Calculator className="w-5 h-5" /> Estimator</h3>
                <div className="text-xs bg-gray-700 px-2 py-1 rounded">{velocity} Pts/Sprint</div>
             </div>
             <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <Input label="Start Date" type="date" value={approach.startDate} onChange={(e) => onUpdateApproach(approach.id, 'startDate', e.target.value)} />
                  <Input label="Target Deadline" type="date" value={approach.targetDate} onChange={(e) => onUpdateApproach(approach.id, 'targetDate', e.target.value)} />
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
                      <div className="flex justify-between mb-1"><span className="text-gray-600">Active Team Size:</span><span className="font-bold">{team.length}</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
                   <div className="flex justify-between items-center pb-3 border-b border-gray-200"><span className="text-sm text-gray-600">Remaining Points</span><span className="font-bold text-gray-900">{stats.totalPoints}</span></div>
                   <div className="flex justify-between items-center pb-3 border-b border-gray-200"><span className="text-sm text-gray-600">Rem. Timeline</span><span className="font-bold text-gray-900">{stats.sprintCount} Sprints</span></div>
                   <div className="flex justify-between items-center pt-1"><span className="text-sm text-gray-600">Completion Date</span></div>
                   <div className={`text-xl font-bold text-center py-2 rounded-lg ${stats.isAtRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{formatDate(stats.projectedEndDate)}</div>
                   {stats.isAtRisk && <div className="text-xs text-red-600 text-center px-2">Misses target by {getBusinessDayDiff(approach.targetDate, stats.projectedEndDate)} working days.</div>}
                </div>
                
                <Button onClick={() => setBreakdownOpen(true)} variant="secondary" className="w-full flex items-center justify-center gap-2 text-xs">
                    <ListTodo className="w-4 h-4" /> Show Breakdown
                </Button>
             </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-2">
              <div className="font-semibold text-gray-700 mb-1">Planning Tools:</div>
              <div className="flex items-center gap-2"><Layers className="w-3 h-3" /> <span><strong>Bundle:</strong> Enter Developer Name to assign directly.</span></div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3" /><span><strong>Min Days:</strong> Duration constraints (e.g. waits).</span></div>
              <div className="flex items-center gap-2"><UserCog className="w-3 h-3" /><span><strong>Capacity:</strong> Adjust for PTO/Junior velocity.</span></div>
          </div>
        </div>
      </div>
    </div>
    
    <DependencyModal isOpen={depModal.open} onClose={() => setDepModal({ ...depModal, open: false })} item={activeItemForDeps} allItems={depModal.type === 'story' ? allStories : approach.epics} onToggleDependency={handleToggleDependency} onClearDependencies={handleClearDependencies} title={depModal.type === 'story' ? `Dependencies for "${activeItemForDeps?.name}"` : `Dependencies for Epic "${activeItemForDeps?.name}"`} />
    <BreakdownModal isOpen={breakdownOpen} onClose={() => setBreakdownOpen(false)} assignments={stats.assignments} startDate={approach.startDate} team={team} />
    </>
  );
};

// --- Initial Data Constant ---
const DEFAULT_TEAM = [{ id: 1, name: 'Lead Dev', capacity: 100 }, { id: 2, name: 'Dev 2', capacity: 100 }];
const DEFAULT_GROUPS = [
    {
        id: 'g1',
        name: 'Alerts Upgrade',
        strategies: [
            {
                id: 1,
                name: "Legacy Backend Upgrade",
                description: "Implement alerts within the existing monolithic architecture.",
                color: "blue",
                startDate: new Date().toISOString().split('T')[0],
                targetDate: new Date(new Date().setDate(new Date().getDate() + 45)).toISOString().split('T')[0],
                epics: [
                    {
                        id: 101,
                        name: "Backend Logic Updates",
                        expanded: true,
                        dependencies: [],
                        stories: [
                            { id: 1, name: "Modify CardOffer Service", points: 13, dependencies: [], bundleId: "A", minDays: 5 },
                            { id: 2, name: "Update Notification Trigger", points: 13, dependencies: [1], bundleId: "A" }, 
                        ]
                    }
                ]
            }
        ]
    }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [selectedApproachId, setSelectedApproachId] = useState(null);
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [velocity, setVelocity] = useState(8); // Default velocity 8
  const [notFound, setNotFound] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedData = localStorage.getItem('techEstDataV2');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.groups) setGroups(parsed.groups);
        if (parsed.team) setTeam(parsed.team);
        if (parsed.velocity) setVelocity(parsed.velocity);
      } catch (e) { console.error("Failed to parse", e); }
    }

    const hash = window.location.hash;
    if (hash.startsWith('#/strategy/')) {
        const id = parseInt(hash.split('/')[2]);
        let found = false;
        // Check all groups
        if (savedData) {
             const parsed = JSON.parse(savedData);
             parsed.groups.forEach(g => {
                 if(g.strategies.find(s => s.id === id)) found = true;
             });
        } else {
             DEFAULT_GROUPS.forEach(g => {
                 if(g.strategies.find(s => s.id === id)) found = true;
             });
        }
        
        if (found) { setSelectedApproachId(id); setActiveTab('edit'); } 
        else { setNotFound(true); }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'edit' && selectedApproachId) window.history.replaceState(null, '', `#/strategy/${selectedApproachId}`);
    else if (activeTab === 'dashboard') { window.history.replaceState(null, '', '#/'); setNotFound(false); }
  }, [activeTab, selectedApproachId]);

  useEffect(() => {
      const handleHashChange = () => {
          const hash = window.location.hash;
          if (hash.startsWith('#/strategy/')) {
             const id = parseInt(hash.split('/')[2]);
             let found = false;
             groups.forEach(g => {
                 if(g.strategies.find(s => s.id === id)) found = true;
             });
             if (found) {
                 setSelectedApproachId(id);
                 setActiveTab('edit');
                 setNotFound(false);
             } else {
                 setNotFound(true);
                 setActiveTab('error');
             }
          } else {
             setActiveTab('dashboard');
             setSelectedApproachId(null);
             setNotFound(false);
          }
      };

      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
  }, [groups]);

  const updateGroups = (newGroups) => { setGroups(newGroups); setHasUnsavedChanges(true); };
  const updateTeam = (newTeam) => { setTeam(newTeam); setHasUnsavedChanges(true); };
  const updateVelocity = (newVelocity) => { setVelocity(newVelocity); setHasUnsavedChanges(true); };

  const handleSave = () => {
    try { localStorage.setItem('techEstDataV2', JSON.stringify({ groups, team, velocity })); setHasUnsavedChanges(false); } 
    catch (e) { alert("Save failed."); }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify({ groups, team, velocity }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `tech-est-v2-${new Date().toISOString().split('T')[0]}.json`);
    linkElement.click();
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (event) => {
    const fileObj = event.target.files && event.target.files[0];
    if (!fileObj) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (window.confirm("Overwrite current data?")) {
            // MIGRATION LOGIC
            let newGroups = [];
            let newTeam = DEFAULT_TEAM;
            let newVelocity = 8; // Default 8

            if (Array.isArray(json)) {
                // V1 Import (Array of Strategies)
                newGroups = [{ id: generateId(), name: "Imported Strategies", strategies: json }];
            } else if (json.groups) {
                // V2 Import
                newGroups = json.groups;
                if (json.team) newTeam = json.team;
                if (json.velocity) newVelocity = json.velocity;
                if (json.velocityPerSprint) newVelocity = json.velocityPerSprint; 
            } else if (json.strategies) {
                // Partial Object Import
                newGroups = [{ id: generateId(), name: "Imported Group", strategies: json.strategies }];
            }

            if (newGroups.length > 0) {
                setGroups(newGroups);
                setTeam(newTeam);
                setVelocity(newVelocity);
                setHasUnsavedChanges(true);
                setActiveTab('dashboard');
                setSelectedApproachId(null);
                window.location.hash = '#/';
            } else {
                alert("Invalid file format. Could not find strategies.");
            }
        }
      } catch (err) { alert("Error parsing JSON."); console.error(err); }
      event.target.value = null; 
    };
    reader.readAsText(fileObj);
  };

  // Drag Handlers
  const handleMoveGroup = (sourceId, targetId) => {
      const sourceIndex = groups.findIndex(g => g.id === sourceId);
      const targetIndex = groups.findIndex(g => g.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;
      
      const newGroups = [...groups];
      const [movedGroup] = newGroups.splice(sourceIndex, 1);
      newGroups.splice(targetIndex, 0, movedGroup);
      updateGroups(newGroups);
  };

  const handleMoveStrategy = (sourceGroupId, strategyId, targetGroupId, targetStrategyId) => {
      const newGroups = [...groups];
      
      // Find Source
      const sourceGroupIndex = newGroups.findIndex(g => g.id === sourceGroupId);
      if (sourceGroupIndex === -1) return;
      const sourceGroup = { ...newGroups[sourceGroupIndex], strategies: [...newGroups[sourceGroupIndex].strategies] };
      
      const strategyIndex = sourceGroup.strategies.findIndex(s => s.id === strategyId);
      if (strategyIndex === -1) return;
      
      // Remove from source
      const [movedStrategy] = sourceGroup.strategies.splice(strategyIndex, 1);
      newGroups[sourceGroupIndex] = sourceGroup;

      // Find Target
      const targetGroupIndex = newGroups.findIndex(g => g.id === targetGroupId);
      // Note: If source and target group are same, use the updated sourceGroup reference
      const targetGroup = targetGroupIndex === sourceGroupIndex ? sourceGroup : { ...newGroups[targetGroupIndex], strategies: [...newGroups[targetGroupIndex].strategies] };
      
      if (targetStrategyId === null) {
          // Add to end of target group
          targetGroup.strategies.push(movedStrategy);
      } else {
          // Insert before target strategy
          const targetIndex = targetGroup.strategies.findIndex(s => s.id === targetStrategyId);
          if (targetIndex !== -1) {
              targetGroup.strategies.splice(targetIndex, 0, movedStrategy);
          } else {
              targetGroup.strategies.push(movedStrategy);
          }
      }
      newGroups[targetGroupIndex] = targetGroup;
      
      updateGroups(newGroups);
  };

  // Group Handlers
  const handleAddGroup = () => {
      const newGroup = { id: generateId(), name: "New Group", strategies: [] };
      updateGroups([...groups, newGroup]);
  };
  const handleUpdateGroup = (gid, field, val) => updateGroups(groups.map(g => g.id === gid ? { ...g, [field]: val } : g));
  const handleDeleteGroup = (gid) => { if(window.confirm("Delete group?")) updateGroups(groups.filter(g => g.id !== gid)); };

  // Strategy Handlers (Nested in groups)
  const handleAddApproach = (groupId) => {
    const newApproach = {
      id: Date.now(), 
      name: "New Strategy", description: "", color: "purple",
      startDate: new Date().toISOString().split('T')[0],
      targetDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      epics: [{ id: generateId(), name: "Setup", expanded: true, stories: [] }]
    };
    updateGroups(groups.map(g => g.id === groupId ? { ...g, strategies: [...g.strategies, newApproach] } : g));
    setSelectedApproachId(newApproach.id); setActiveTab('edit');
  };

  const handleCopyApproach = (e, groupId, approachId) => {
      e.stopPropagation();
      const group = groups.find(g => g.id === groupId);
      const app = group.strategies.find(s => s.id === approachId);
      if(!app) return;
      
      const idMap = new Map();
      const newEpics = app.epics.map(epic => {
          const newEpicId = generateId(); idMap.set(epic.id, newEpicId);
          const newStories = epic.stories.map(s => { const nid = generateId(); idMap.set(s.id, nid); return {...s, id: nid}; });
          return { ...epic, id: newEpicId, stories: newStories };
      });
      const resolvedEpics = newEpics.map(epic => ({
          ...epic, dependencies: (epic.dependencies||[]).map(d => idMap.get(d)||d),
          stories: epic.stories.map(s => ({...s, dependencies: (s.dependencies||[]).map(d => idMap.get(d)||d)}))
      }));
      
      const newApp = { ...app, id: Date.now(), name: `Copy of ${app.name}`, epics: resolvedEpics };
      updateGroups(groups.map(g => g.id === groupId ? { ...g, strategies: [...g.strategies, newApp] } : g));
  };

  const handleDeleteApproach = (e, groupId, approachId) => {
      e.stopPropagation();
      if(window.confirm("Delete strategy?")) {
          updateGroups(groups.map(g => g.id === groupId ? { ...g, strategies: g.strategies.filter(s => s.id !== approachId) } : g));
          if(selectedApproachId === approachId) { setSelectedApproachId(null); setActiveTab('dashboard'); }
      }
  };

  const updateApproachDeep = (appId, updateFn) => {
      updateGroups(groups.map(g => ({
          ...g,
          strategies: g.strategies.map(s => s.id === appId ? updateFn(s) : s)
      })));
  };

  // Detail View Handlers
  const handleUpdateApproach = (id, field, value) => updateApproachDeep(id, s => ({ ...s, [field]: value }));
  const handleAddEpic = (id) => updateApproachDeep(id, s => ({ ...s, epics: [...s.epics, { id: generateId(), name: "New Epic", expanded: true, stories: [] }] }));
  const handleDeleteEpic = (id, eid) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.filter(e => e.id !== eid) }));
  const handleToggleEpic = (id, eid) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, expanded: !e.expanded } : e) }));
  const handleToggleEpicDone = (id, eid) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, isDone: !e.isDone } : e) }));
  const handleUpdateEpicName = (id, eid, name) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, name } : e) }));
  const handleUpdateEpicDependency = (id, eid, deps) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, dependencies: deps } : e) }));
  
  const handleCopyEpic = (id, eid) => updateApproachDeep(id, s => {
      const src = s.epics.find(e => e.id === eid);
      if(!src) return s;
      const idMap = new Map();
      const newStories = src.stories.map(st => { const nid = generateId(); idMap.set(st.id, nid); return {...st, id: nid}; });
      const resStories = newStories.map(st => ({ ...st, dependencies: (st.dependencies||[]).map(d => idMap.get(d)||d) }));
      return { ...s, epics: [...s.epics, { ...src, id: generateId(), name: `${src.name} (Copy)`, stories: resStories }] };
  });

  const handleAddStory = (id, eid) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, stories: [...e.stories, { id: generateId(), name: "New Story", points: 1 }] } : e) }));
  const handleDeleteStory = (id, eid, sid) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, stories: e.stories.filter(st => st.id !== sid) } : e) }));
  const handleUpdateStory = (id, eid, sid, field, val) => updateApproachDeep(id, s => ({ ...s, epics: s.epics.map(e => e.id === eid ? { ...e, stories: e.stories.map(st => st.id === sid ? { ...st, [field]: val } : st) } : e) }));

  const handleMoveStory = (id, sEid, sSid, tEid, tSid) => updateApproachDeep(id, app => {
      const epics = [...app.epics];
      const sEIdx = epics.findIndex(e => e.id === sEid);
      if(sEIdx === -1) return app;
      const sEpic = { ...epics[sEIdx], stories: [...epics[sEIdx].stories] };
      const sSIdx = sEpic.stories.findIndex(s => s.id === sSid);
      if(sSIdx === -1) return app;
      const [story] = sEpic.stories.splice(sSIdx, 1);
      epics[sEIdx] = sEpic;

      const tEIdx = epics.findIndex(e => e.id === tEid);
      const tEpic = tEIdx === sEIdx ? sEpic : { ...epics[tEIdx], stories: [...epics[tEIdx].stories] };
      
      if(tSid === null) tEpic.stories.push(story);
      else {
          const tSIdx = tEpic.stories.findIndex(s => s.id === tSid);
          tEpic.stories.splice(tSIdx, 0, story);
      }
      epics[tEIdx] = tEpic;
      return { ...app, epics };
  });

  const handleMoveEpic = (id, sEid, tEid) => updateApproachDeep(id, app => {
      const epics = [...app.epics];
      const sIdx = epics.findIndex(e => e.id === sEid);
      const tIdx = epics.findIndex(e => e.id === tEid);
      if(sIdx === -1 || tIdx === -1) return app;
      const [moved] = epics.splice(sIdx, 1);
      epics.splice(tIdx, 0, moved);
      return { ...app, epics };
  });

  // Current Approach Resolution
  let currentApproach = null;
  groups.forEach(g => { const found = g.strategies.find(s => s.id === selectedApproachId); if(found) currentApproach = found; });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.hash = '#/'; }}>
              <div className="bg-blue-600 text-white p-2 rounded-lg"><BarChart3 className="w-6 h-6" /></div>
              <h1 className="text-xl font-bold text-gray-900 hidden sm:block">COMMS <span className="font-normal text-gray-500">| Epic Estimator</span></h1>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
               <button onClick={() => setTeamModalOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md">
                   <Users className="w-4 h-4" /> Global Team
               </button>
               <div className="w-px h-6 bg-gray-200 mx-2 hidden md:block"></div>
               <nav className="flex space-x-2">
                 <button onClick={() => { window.location.hash = '#/'; }} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}>Dashboard</button>
                 {selectedApproachId && !notFound && <button onClick={() => setActiveTab('edit')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'edit' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}>Edit Details</button>}
               </nav>
               <div className="w-px h-6 bg-gray-200 mx-2 hidden md:block"></div>
               <Button onClick={handleSave} variant={hasUnsavedChanges ? "primary" : "secondary"} size="sm" className="flex items-center gap-2" title="Save changes to local storage"><Save className="w-4 h-4" /><span className="hidden md:inline">{hasUnsavedChanges ? "Save Changes" : "Saved"}</span></Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notFound ? <NotFoundView onGoHome={() => window.location.hash = '#/'} /> : 
         activeTab === 'dashboard' ? 
          <DashboardView groups={groups} team={team} velocity={velocity} onSelectApproach={(id) => { window.location.hash = `#/strategy/${id}`; }} onDeleteApproach={handleDeleteApproach} onCopyApproach={handleCopyApproach} onAddApproach={handleAddApproach} onAddGroup={handleAddGroup} onUpdateGroup={handleUpdateGroup} onDeleteGroup={handleDeleteGroup} onMoveGroup={handleMoveGroup} onMoveStrategy={handleMoveStrategy} onImportClick={handleImportClick} onExport={handleExport} fileInputRef={fileInputRef} onFileChange={handleFileChange} /> 
         : 
          <DetailsView approach={currentApproach} team={team} velocity={velocity} onUpdateApproach={handleUpdateApproach} onAddEpic={handleAddEpic} onToggleEpic={handleToggleEpic} onUpdateEpicName={handleUpdateEpicName} onDeleteEpic={handleDeleteEpic} onCopyEpic={handleCopyEpic} onToggleEpicDone={handleToggleEpicDone} onUpdateStory={handleUpdateStory} onDeleteStory={handleDeleteStory} onAddStory={handleAddStory} onMoveStory={handleMoveStory} onMoveEpic={handleMoveEpic} onUpdateEpicDependency={handleUpdateEpicDependency} />
        }
      </main>
      
      <TeamModal isOpen={teamModalOpen} onClose={() => setTeamModalOpen(false)} team={team} onChange={updateTeam} velocity={velocity} onVelocityChange={updateVelocity} />
    </div>
  );
}

// --- Helper Components ---

const StoryTypeIcon = ({ type }) => {
    switch (type) {
        case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
        case 'spike': return <Beaker className="w-4 h-4 text-purple-500" />;
        case 'discovery': return <Search className="w-4 h-4 text-blue-500" />;
        case 'task': return <CheckSquare className="w-4 h-4 text-gray-500" />;
        default: return <BookOpen className="w-4 h-4 text-green-600" />; // story
    }
};

const StoryRow = ({ 
    story, 
    epic, 
    approach, 
    handleDragStart, 
    handleDragOver, 
    handleDrop, 
    onUpdateStory, 
    onDeleteStory, 
    handleOpenStoryDeps, 
    isExpanded, 
    onToggleExpand 
}) => {
    return (
        <div 
            draggable 
            onDragStart={(e) => handleDragStart(e, 'story', story.id, epic.id)} 
            onDragOver={handleDragOver} 
            onDrop={(e) => handleDrop(e, 'story', story.id, epic.id)} 
            className={`border border-transparent hover:border-gray-200 hover:shadow-sm rounded-md transition-all ${story.isDone || epic.isDone ? 'opacity-60 bg-gray-50/50' : 'bg-white'}`}
        >
            {/* Primary Row */}
            <div className="flex items-center gap-3 p-2 -mx-1">
                <div className="flex items-center w-full sm:w-auto flex-1 gap-2">
                    <div className="cursor-move text-gray-300 hover:text-gray-500"><GripVertical className="w-4 h-4" /></div>
                    <button onClick={() => onUpdateStory(approach.id, epic.id, story.id, 'isDone', !story.isDone)} className="text-gray-300 hover:text-blue-600 transition-colors" disabled={epic.isDone}>
                        {story.isDone || epic.isDone ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                    
                    {/* Type Indicator (Visual only, edit in expanded) */}
                    <div className="flex-shrink-0" title={story.type || 'story'}>
                        <StoryTypeIcon type={story.type} />
                    </div>

                    <div className="flex-1 min-w-0 mr-2">
                        <input 
                            value={story.name} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'name', e.target.value)} 
                            className={`w-full text-sm border-b border-transparent focus:border-blue-300 focus:outline-none px-1 py-0.5 ${story.isDone || epic.isDone ? 'text-gray-500 line-through' : 'text-gray-700'}`} 
                            placeholder="Story name..." 
                        />
                        {/* Compact Indicators */}
                        <div className="flex items-center gap-3 mt-1 h-4">
                             {story.dependencies && story.dependencies.length > 0 && (
                                <div className="flex items-center gap-1"><LinkIcon className="w-3 h-3 text-orange-400" /><span className="text-[10px] text-gray-500 truncate">Depends on {story.dependencies.length}</span></div>
                             )}
                             {story.blockedUntil && (
                                <div className="flex items-center gap-1"><CalendarClock className="w-3 h-3 text-red-400" /><span className="text-[10px] text-red-500 truncate">Blocked: {formatDate(story.blockedUntil)}</span></div>
                             )}
                             {story.bundleId && <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0 rounded text-[10px] text-gray-600 font-medium"><Layers className="w-3 h-3 text-gray-500" />{story.bundleId}</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {/* Points Input */}
                    <div className="w-14">
                        <input 
                            type="number" 
                            min="0" 
                            value={story.points} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'points', parseFloat(e.target.value))} 
                            className="w-full text-sm text-right border rounded px-1 py-1 focus:border-blue-500 font-medium" 
                            placeholder="Pts"
                        />
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => onToggleExpand(story.id)} className={`p-1.5 rounded transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'}`} title="Edit Details">
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleOpenStoryDeps(story)} className={`p-1.5 rounded transition-colors ${story.dependencies?.length > 0 ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'}`} title="Dependencies">
                            <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteStory(approach.id, epic.id, story.id)} className="text-gray-300 hover:text-red-500 p-1.5" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Details Panel */}
            {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-md grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="col-span-1 sm:col-span-2">
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Description</label>
                        <textarea 
                            value={story.description || ''} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'description', e.target.value)} 
                            className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                            rows={2} 
                            placeholder="Add acceptance criteria or notes..." 
                        />
                    </div>
                    
                    <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Story Type</label>
                        <select 
                            value={story.type || 'story'} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'type', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="story">User Story</option>
                            <option value="task">Task / Chore</option>
                            <option value="bug">Bug Fix</option>
                            <option value="spike">Spike / Research</option>
                            <option value="discovery">Discovery</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Blocked Until</label>
                        <input 
                            type="date" 
                            value={story.blockedUntil || ''} 
                            onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'blockedUntil', e.target.value)} 
                            className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>

                    <div>
                         <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Bundle ID / Developer</label>
                         <input 
                             value={story.bundleId || ''} 
                             onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'bundleId', e.target.value)} 
                             className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                             placeholder="e.g. 'Auth' or 'John'"
                         />
                    </div>

                    <div>
                         <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Wait Time (Days)</label>
                         <input 
                             type="number" 
                             min="0"
                             value={story.minDays || ''} 
                             onChange={(e) => onUpdateStory(approach.id, epic.id, story.id, 'minDays', parseFloat(e.target.value))} 
                             className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" 
                             placeholder="Minimum calendar days"
                         />
                    </div>
                </div>
            )}
        </div>
    );
};
