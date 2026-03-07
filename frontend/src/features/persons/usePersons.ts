import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import * as api from '../../api/client';
import type { PersonCreate, PersonUpdate } from '../../types/models';
import { showSnackbar } from '../../components/ui/Snackbar';

/**
 * Hook to manage Persons data fetching and mutations.
 */
export function usePersons() {
    const { persons, isLoadingPersons, setPersons, setPersonsLoading } = useStore();

    // Fetch all persons
    const fetchPersons = async () => {
        if (isLoadingPersons) {
            return;
        }
        setPersonsLoading(true);
        try {
            const data = await api.getPersons();
            setPersons(data);
        } catch (err: any) {
            showSnackbar(`Failed to load people: ${err.message}`);
        } finally {
            setPersonsLoading(false);
        }
    };

    // Create a person
    const createPerson = async (data: PersonCreate) => {
        try {
            const newPerson = await api.createPerson(data);
            setPersons([...persons, newPerson]);
            showSnackbar('Person added successfully');
            return newPerson;
        } catch (err: any) {
            showSnackbar(`Failed to add person: ${err.message}`);
            throw err;
        }
    };

    // Update a person
    const updatePerson = async (id: number, data: PersonUpdate) => {
        try {
            const updated = await api.updatePerson(id, data);
            setPersons(persons.map(p => p.id === updated.id ? updated : p));
            showSnackbar('Person updated');
            return updated;
        } catch (err: any) {
            showSnackbar(`Failed to update person: ${err.message}`);
            throw err;
        }
    };

    // Delete a person
    const deletePerson = async (id: number) => {
        try {
            await api.deletePerson(id);
            setPersons(persons.filter(p => p.id !== id));
            showSnackbar('Person deleted');
        } catch (err: any) {
            showSnackbar(`Failed to delete person: ${err.message}`);
            throw err;
        }
    };

    useEffect(() => {
        if (persons.length === 0 && !isLoadingPersons) {
            fetchPersons();
        }
    }, [persons.length, isLoadingPersons]);

    return {
        persons,
        isLoading: isLoadingPersons,
        fetchPersons,
        createPerson,
        updatePerson,
        deletePerson
    };
}
